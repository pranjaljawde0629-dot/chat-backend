
import { Request, Response, NextFunction } from "express";
import jwt from "../config/jwt";

// Extend Express Request to store authenticated user information
export interface AuthRequest extends Request {
  userId?: string;
}

export function verifyToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Read Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token is required."
      });
    }

    // Extract Bearer token
    const [scheme, token] = authHeader.trim().split(/\s+/);

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format."
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };

    // Store user ID in request
    req.userId = decoded.userId;

    // Continue to next middleware or route
    next();

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}
