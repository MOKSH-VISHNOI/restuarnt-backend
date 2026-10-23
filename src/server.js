require("dotenv").config();

const cors = require("cors");
const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");

if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
  console.warn("⚠️  RAZORPAY_WEBHOOK_SECRET is not set. Webhook signature verification will fail.");
}
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️  Razorpay API keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured.");
}
if (!process.env.PAYMENT_REFUND_API_KEY) {
  console.warn("⚠️  PAYMENT_REFUND_API_KEY is not set. Refund requests will be rejected.");
}



const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.set("io", io);

const { createPaymentExpiryJob } = require("./jobs/paymentExpiryJob");
const expiryJob = createPaymentExpiryJob({ io });
expiryJob.startPaymentExpiryJob();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
