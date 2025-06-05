# Task Scheduler

A backend job scheduling system with a frontend interface to schedule and manage jobs running at hourly, daily, or weekly intervals. Jobs print "Hello World" to the console and the system keeps track of job execution logs.

## Features

- Schedule jobs with flexible options:
  - Hourly (at a specified minute)
  - Daily (at a specified hour and minute)
  - Weekly (on a specified day, hour, and minute)
- View all scheduled jobs with details and status
- Cancel or remove scheduled jobs
- Execution logs showing last run time and run count
- Frontend with form validation and live job list updates

## Technologies Used

- Node.js with Express for backend
- node-schedule for job scheduling
- Vanilla JavaScript, HTML, CSS for frontend

## Installation and Usage

1. Clone the repo
2. Run `npm install` to install dependencies
3. Run `node index.js` to start the server
4. Open `http://localhost:3000` in your browser to use the frontend

## License

MIT

---

*Developed as part of software developer internship assignment for Alchelyst India Pvt Ltd.*
