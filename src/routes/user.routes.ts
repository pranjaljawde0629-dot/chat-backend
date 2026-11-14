
import express, { Response } from "express";
import prisma from "../config/prisma";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";

const router = express.Router();

// GET /user/:userId/chats
router.get(
    "/:userId/chats",
    verifyToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const { userId } = req.params;
            const authenticatedUserId = req.userId;

            if (!authenticatedUserId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            if (userId !== authenticatedUserId) {
                return res.status(403).json({
                    success: false,
                    message: "You can only access your own chats."
                });
            }

            const memberships = await prisma.chatMember.findMany({
                where: {
                    userId
                },
                include: {
                    chat: {
                        include: {
                            members: {
                                select: {
                                    userId: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    joinedAt: "desc"
                }
            });

            const chats = memberships.map((membership) => ({
                chatId: membership.chat.id,
                isGroup: membership.chat.isGroup,
                createdAt: membership.chat.createdAt,
                memberIds: membership.chat.members.map(
                    (member) => member.userId
                )
            }));

            return res.status(200).json({
                success: true,
                message: "User chats fetched successfully!",
                data: chats
            });
        } catch (error) {
            console.error("Get user chats error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch user chats."
            });
        }
    }
);

export default router;
