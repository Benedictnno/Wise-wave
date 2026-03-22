/**
 * Simple in-memory retry scheduler for lead delivery. 
 * For production scale, consider BullMQ or similar.
 */
const retryQueue = [];

/**
 * Schedule a retry for a specific lead delivery.
 * @param {Function} task - the function to execute (notificationEngine.dispatch)
 * @param {Number} delayMs - delay in ms
 */
const scheduleRetry = (task, delayMs, description = '') => {
    console.log(`[Queue] Scheduling retry in ${delayMs/1000}s: ${description}`);
    const timeoutId = setTimeout(async () => {
        try {
            await task();
        } catch (err) {
            console.error(`[Queue] Retry task failed: ${description}`, err.message);
        } finally {
            // Remove from queue
            const idx = retryQueue.findIndex(q => q.id === timeoutId);
            if (idx > -1) retryQueue.splice(idx, 1);
        }
    }, delayMs);

    retryQueue.push({ id: timeoutId, description, scheduledAt: new Date() });
    return timeoutId;
};

module.exports = { scheduleRetry };
