
import express, { Request, Response } from "express";

import authRoutes from "./routes/auth.routes";
import chatRoutes from "./routes/chat.routes";
import messageRoutes from "./routes/message.routes";
import userRoutes from "./routes/user.routes";

import { verifyToken, AuthRequest } from "./middleware/auth.middleware";

const app = express();

const PORT = 5000;

// Middleware
app.use(express.json());

// Health check
app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: "Chat Backend API is running successfully!"
    });
});

// Protected test route
app.get(
    "/api/protected",
    verifyToken,
    (req: AuthRequest, res: Response) => {
        res.status(200).json({
            success: true,
            message: "You have accessed a protected route!",
            userId: req.userId
        });
    }
);

// Authentication routes
app.use("/api/auth", authRoutes);

// Required assignment routes
app.use("/chat", chatRoutes);
app.use("/chat", messageRoutes);
app.use("/user", userRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
