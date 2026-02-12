/**
 * Emit saved notifications to recipients via Socket.io.
 * @param {object} io - The Socket.io server instance
 * @param {Array|object} notifications - saved notification doc(s)
 */
function emitNotifications(io, notifications) {
    if (!io) return;
    const list = Array.isArray(notifications) ? notifications : [notifications];
    for (const n of list) {
        const recipientId = n.recipient?.toString();
        if (recipientId) {
            io.to(`notif:${recipientId}`).emit('notification:new', n);
        }
    }
}
module.exports = { emitNotifications };