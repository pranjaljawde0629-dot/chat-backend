
import express, { Response } from "express";
import prisma from "../config/prisma";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";

const router = express.Router();

// POST /chat/create
router.post(
    "/create",
    verifyToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const authenticatedUserId = req.userId;
            const { userAId, userBId } = req.body;

            if (!authenticatedUserId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            if (
                typeof userAId !== "string" ||
                typeof userBId !== "string" ||
                !userAId.trim() ||
                !userBId.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Both userAId and userBId are required."
                });
            }

            if (userAId === userBId) {
                return res.status(400).json({
                    success: false,
                    message: "A chat requires two different users."
                });
            }

            // The authenticated user must be one of the two participants.
            if (
                authenticatedUserId !== userAId &&
                authenticatedUserId !== userBId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You can only create a chat you participate in."
                });
            }

            const users = await prisma.user.findMany({
                where: {
                    id: {
                        in: [userAId, userBId]
                    }
                },
                select: {
                    id: true
                }
            });

            if (users.length !== 2) {
                return res.status(404).json({
                    success: false,
                    message: "One or both users were not found."
                });
            }

            // Avoid creating a duplicate one-to-one chat.
            const existingChats = await prisma.chat.findMany({
                where: {
                    isGroup: false,
                    AND: [
                        { members: { some: { userId: userAId } } },
                        { members: { some: { userId: userBId } } }
                    ]
                },
                include: {
                    members: {
                        select: {
                            userId: true
                        }
                    }
                }
            });

            const existingChat = existingChats.find(
                (chat) =>
                    chat.members.length === 2 &&
                    chat.members.some((member) => member.userId === userAId) &&
                    chat.members.some((member) => member.userId === userBId)
            );

            if (existingChat) {
                return res.status(200).json({
                    success: true,
                    message: "Chat already exists.",
                    data: {
                        chatId: existingChat.id
                    }
                });
            }

            const newChat = await prisma.chat.create({
                data: {
                    isGroup: false,
                    members: {
                        create: [
                            { userId: userAId },
                            { userId: userBId }
                        ]
                    }
                },
                select: {
                    id: true
                }
            });

            return res.status(201).json({
                success: true,
                message: "Chat created successfully!",
                data: {
                    chatId: newChat.id
                }
            });
        } catch (error) {
            console.error("Create chat error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to create chat."
            });
        }
    }
);

export default router;
