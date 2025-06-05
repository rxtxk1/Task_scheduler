const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const JOBS_FILE = path.join(__dirname, 'jobs.json');

let jobs = [];
let jobIdCounter = 1;

// Load jobs from file or initialize empty
function loadJobs() {
  if (fs.existsSync(JOBS_FILE)) {
    const data = fs.readFileSync(JOBS_FILE, 'utf-8');
    jobs = JSON.parse(data);
    // Update id counter to max id + 1
    jobIdCounter = jobs.reduce((maxId, j) => Math.max(maxId, j.id), 0) + 1;
  } else {
    jobs = [];
  }
}
loadJobs();

function saveJobs() {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

// Helper to validate schedule input
function validateSchedule(data) {
  const errors = [];
  if (!['hourly', 'daily', 'weekly'].includes(data.type)) {
    errors.push('Invalid schedule type.');
  }
  if (data.type === 'hourly') {
    if (data.minute === undefined || isNaN(data.minute) || data.minute < 0 || data.minute > 59) {
      errors.push('Minute must be between 0 and 59 for hourly schedule.');
    }
  }
  if (data.type === 'daily') {
    if (data.hour === undefined || isNaN(data.hour) || data.hour < 0 || data.hour > 23) {
      errors.push('Hour must be between 0 and 23 for daily schedule.');
    }
    if (data.minute === undefined || isNaN(data.minute) || data.minute < 0 || data.minute > 59) {
      errors.push('Minute must be between 0 and 59 for daily schedule.');
    }
  }
  if (data.type === 'weekly') {
    if (data.dayOfWeek === undefined || isNaN(data.dayOfWeek) || data.dayOfWeek < 0 || data.dayOfWeek > 6) {
      errors.push('DayOfWeek must be between 0 (Sun) and 6 (Sat) for weekly schedule.');
    }
    if (data.hour === undefined || isNaN(data.hour) || data.hour < 0 || data.hour > 23) {
      errors.push('Hour must be between 0 and 23 for weekly schedule.');
    }
    if (data.minute === undefined || isNaN(data.minute) || data.minute < 0 || data.minute > 59) {
      errors.push('Minute must be between 0 and 59 for weekly schedule.');
    }
  }
  return errors;
}

// Job runner logic
const runningTimers = new Map(); // Map<jobId, timeoutId>

// Remove any existing timer for a job
function clearJobTimer(jobId) {
  if (runningTimers.has(jobId)) {
    clearTimeout(runningTimers.get(jobId));
    runningTimers.delete(jobId);
  }
}

// Schedule next execution for a job
function scheduleJobRun(job) {
  if (job.status !== 'active') return; // Only active jobs run

  // Calculate next run time from now
  const now = new Date();
  let nextRun;

  if (job.type === 'hourly') {
    // Run at the specified minute every hour
    nextRun = new Date(now);
    nextRun.setSeconds(0, 0);
    nextRun.setMinutes(job.minute);
    if (nextRun <= now) nextRun.setHours(nextRun.getHours() + 1);
  } else if (job.type === 'daily') {
    // Run at hour:minute every day
    nextRun = new Date(now);
    nextRun.setSeconds(0, 0);
    nextRun.setHours(job.hour);
    nextRun.setMinutes(job.minute);
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
  } else if (job.type === 'weekly') {
    // Run on dayOfWeek at hour:minute
    nextRun = new Date(now);
    nextRun.setSeconds(0, 0);
    const currentDay = nextRun.getDay();
    let daysUntil = job.dayOfWeek - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && (nextRun.getHours() > job.hour || (nextRun.getHours() === job.hour && nextRun.getMinutes() >= job.minute)))) {
      daysUntil += 7;
    }
    nextRun.setDate(nextRun.getDate() + daysUntil);
    nextRun.setHours(job.hour);
    nextRun.setMinutes(job.minute);
  }

  const delay = nextRun.getTime() - now.getTime();

  // Set a timer
  const timeoutId = setTimeout(() => {
    // Execute job: print Hello World + log execution
    console.log(`Job #${job.id} running: Hello World! Time: ${new Date().toLocaleString()}`);

    job.runCount = (job.runCount || 0) + 1;
    job.lastRun = new Date().toISOString();
    job.logs = job.logs || [];
    job.logs.push(`Run #${job.runCount} at ${job.lastRun}`);

    saveJobs();

    // Reschedule next run
    scheduleJobRun(job);
  }, delay);

  runningTimers.set(job.id, timeoutId);
}

// Schedule all active jobs on server start
function scheduleAllJobs() {
  jobs.forEach(job => {
    if (job.status === 'active') scheduleJobRun(job);
  });
}
scheduleAllJobs();

// POST /schedule - create a new job
app.post('/schedule', (req, res) => {
  const data = req.body;

  // Convert strings to numbers if possible
  if (data.hour !== undefined) data.hour = Number(data.hour);
  if (data.minute !== undefined) data.minute = Number(data.minute);
  if (data.dayOfWeek !== undefined) data.dayOfWeek = Number(data.dayOfWeek);

  const errors = validateSchedule(data);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  const newJob = {
    id: jobIdCounter++,
    type: data.type,
    hour: data.hour,
    minute: data.minute,
    dayOfWeek: data.dayOfWeek,
    status: 'active',
    runCount: 0,
    lastRun: null,
    logs: []
  };
  jobs.push(newJob);
  saveJobs();

  scheduleJobRun(newJob);

  res.json({ message: `Job #${newJob.id} scheduled successfully.`, job: newJob });
});

// GET /jobs - list all jobs
app.get('/jobs', (req, res) => {
  res.json(jobs);
});

// DELETE /jobs/:id - cancel a job
app.delete('/jobs/:id', (req, res) => {
  const id = Number(req.params.id);
  const jobIndex = jobs.findIndex(j => j.id === id);
  if (jobIndex === -1) {
    return res.status(404).json({ error: 'Job not found.' });
  }

  // Cancel job timer and update status
  clearJobTimer(id);
  jobs[jobIndex].status = 'cancelled';
  saveJobs();
  res.json({ message: `Job #${id} cancelled successfully.` });
});

// GET /jobs/:id/logs - get execution logs for a job
app.get('/jobs/:id/logs', (req, res) => {
  const id = Number(req.params.id);
  const job = jobs.find(j => j.id === id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found.' });
  }
  res.json({ logs: job.logs || [], runCount: job.runCount || 0, lastRun: job.lastRun });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
