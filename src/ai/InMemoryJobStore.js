const { v4: uuidv4 } = require('uuid');

class InMemoryJobStore {
  constructor() {
    this.jobs = new Map();
  }

  createJob(initial) {
    const jobId = uuidv4();
    const job = Object.assign({ id: jobId, status: 'accepted', createdAt: Date.now(), iterations: 0 }, initial);
    this.jobs.set(jobId, job);
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    Object.assign(job, updates);
    this.jobs.set(jobId, job);
    return job;
  }
}

module.exports = { InMemoryJobStore };
