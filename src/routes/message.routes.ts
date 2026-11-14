
import express, { Response } from "express";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import prisma from "../config/prisma";
import { firestore } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

const router = express.Router();

const messagesCollection = firestore.collection("messages");

async function isChatMember(
    chatId: string,
    userId: string
): Promise<boolean> {
    const membership = await prisma.chatMember.findFirst({
        where: {
            chatId,
            userId
        }
    });

    return Boolean(membership);
}

// POST /chat/:chatId/message/send
router.post(
    "/:chatId/message/send",
    verifyToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const chatId = req.params.chatId;
            const { senderId, text } = req.body;
            const authenticatedUserId = req.userId;

            if (typeof chatId !== "string" || !chatId.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid chat ID."
                });
            }

            if (!authenticatedUserId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            if (
                typeof senderId !== "string" ||
                senderId !== authenticatedUserId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Sender ID must match the authenticated user."
                });
            }

            if (typeof text !== "string" || !text.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Message text is required."
                });
            }

            const isMember = await isChatMember(
                chatId,
                authenticatedUserId
            );

            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of this chat."
                });
            }

            const messageRef = await messagesCollection.add({
                chatId,
                senderId: authenticatedUserId,
                text: text.trim(),
                createdAt: FieldValue.serverTimestamp(),
                readBy: [authenticatedUserId]
            });

            return res.status(201).json({
                success: true,
                message: "Message sent successfully!",
                data: {
                    messageId: messageRef.id,
                    chatId,
                    senderId: authenticatedUserId,
                    text: text.trim(),
                    readBy: [authenticatedUserId]
                }
            });
        } catch (error) {
            console.error("Send message error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to send message."
            });
        }
    }
);

// GET /chat/:chatId/messages?limit=50
router.get(
    "/:chatId/messages",
    verifyToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const chatId = req.params.chatId;
            const userId = req.userId;

            if (typeof chatId !== "string" || !chatId.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid chat ID."
                });
            }

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            const isMember = await isChatMember(chatId, userId);

            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of this chat."
                });
            }

            const requestedLimit = req.query.limit === undefined
                ? 50
                : Number(req.query.limit);

            if (
                !Number.isInteger(requestedLimit) ||
                requestedLimit < 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Limit must be a positive integer."
                });
            }

            const limit = Math.min(requestedLimit, 100);
            const cursor = req.query.cursor;

            let query = messagesCollection
                .where("chatId", "==", chatId)
                .orderBy("createdAt", "asc");

            if (typeof cursor === "string" && cursor.trim()) {
                const cursorDoc = await messagesCollection
                    .doc(cursor)
                    .get();

                if (
                    !cursorDoc.exists ||
                    cursorDoc.data()?.chatId !== chatId
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid pagination cursor."
                    });
                }

                query = query.startAfter(cursorDoc);
            }

            const snapshot = await query.limit(limit + 1).get();

            const hasMore = snapshot.docs.length > limit;
            const messageDocs = snapshot.docs.slice(0, limit);

            const messages = messageDocs.map((doc) => ({
                messageId: doc.id,
                ...doc.data()
            }));

            const nextCursor =
                hasMore && messageDocs.length > 0
                    ? messageDocs[messageDocs.length - 1].id
                    : null;

            return res.status(200).json({
                success: true,
                message: "Messages fetched successfully!",
                data: messages,
                pagination: {
                    limit,
                    hasMore,
                    nextCursor
                }
            });
        } catch (error) {
            console.error("Get messages error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch messages."
            });
        }
    }
);

// POST /chat/:chatId/message/:messageId/read
router.post(
    "/:chatId/message/:messageId/read",
    verifyToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const chatId = req.params.chatId;
            const messageId = req.params.messageId;
            const { userId } = req.body;
            const authenticatedUserId = req.userId;

            if (
                typeof chatId !== "string" ||
                !chatId.trim() ||
                typeof messageId !== "string" ||
                !messageId.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid chat ID or message ID."
                });
            }

            if (!authenticatedUserId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            if (
                typeof userId !== "string" ||
                userId !== authenticatedUserId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "User ID must match the authenticated user."
                });
            }

            const isMember = await isChatMember(
                chatId,
                authenticatedUserId
            );

            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of this chat."
                });
            }

            const messageRef = messagesCollection.doc(messageId);
            const messageDoc = await messageRef.get();

            if (
                !messageDoc.exists ||
                messageDoc.data()?.chatId !== chatId
            ) {
                return res.status(404).json({
                    success: false,
                    message: "Message not found in this chat."
                });
            }

            await messageRef.update({
                readBy: FieldValue.arrayUnion(authenticatedUserId)
            });

            return res.status(200).json({
                success: true,
                message: "Message marked as read successfully!",
                data: {
                    chatId,
                    messageId,
                    userId: authenticatedUserId
                }
            });
        } catch (error) {
            console.error("Mark message as read error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to mark message as read."
            });
        }
    }
);

// POST /chat/:chatId/lastseen
router.post(
    "/:chatId/lastseen",
    verifyToken,
    async (req: AuthRequest, res: Response) => {
        try {
            const chatId = req.params.chatId;
            const { userId, messageId } = req.body;
            const authenticatedUserId = req.userId;

            if (typeof chatId !== "string" || !chatId.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid chat ID."
                });
            }

            if (!authenticatedUserId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            if (
                typeof userId !== "string" ||
                userId !== authenticatedUserId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "User ID must match the authenticated user."
                });
            }

            if (typeof messageId !== "string" || !messageId.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Message ID is required."
                });
            }

            const isMember = await isChatMember(
                chatId,
                authenticatedUserId
            );

            if (!isMember) {
                return res.status(403).json({
                    success: false,
                    message: "You are not a member of this chat."
                });
            }

            const messageDoc = await messagesCollection
                .doc(messageId)
                .get();

            if (
                !messageDoc.exists ||
                messageDoc.data()?.chatId !== chatId
            ) {
                return res.status(404).json({
                    success: false,
                    message: "Message not found in this chat."
                });
            }

            await firestore
                .collection("chat_presence")
                .doc(`${chatId}_${authenticatedUserId}`)
                .set(
                    {
                        chatId,
                        userId: authenticatedUserId,
                        lastSeenMessageId: messageId,
                        lastSeenAt: FieldValue.serverTimestamp()
                    },
                    { merge: true }
                );

            return res.status(200).json({
                success: true,
                message: "Last seen updated successfully!",
                data: {
                    chatId,
                    userId: authenticatedUserId,
                    lastSeenMessageId: messageId
                }
            });
        } catch (error) {
            console.error("Update last seen error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to update last seen."
            });
        }
    }
);

export default router;
