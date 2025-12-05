
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();

const db = admin.firestore();

// Nodemailer transport for volunteer emails
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "professional.mathematics.ja@gmail.com",
    pass: "reym bdoc kcrd fehw", // Use an "App Password"
  },
});

export const sendVolunteerEmail = onDocumentCreated("volunteers/{volunteerId}",
  (event) => {
    const data = event.data?.data();
    if (!data) {
      console.log("No data found in volunteer document.");
      return;
    }

    const mailOptions = {
      from: "your-app-name@your-domain.com",
      to: "professional.mathematics.ja@gmail.com", // Your email
      subject: `New Volunteer Application: ${data.name}`,
      html: `
      <p>A new volunteer application has been submitted:</p>
      <ul>
        <li><strong>Name:</strong> ${data.name}</li>
        <li><strong>Email:</strong> ${data.email}</li>
        <li><strong>Message:</strong> ${data.message}</li>
      </ul>
    `,
    };

    return transporter.sendMail(mailOptions);
  });

// --- Notification Functions ---

// Creates a notification document
const createNotification = async (
  recipientId: string,
  notificationData: any,
) => {
  if (recipientId === notificationData.senderId) {
    console.log("Skipping notification for user's own action.");
    return;
  }
  return db
    .collection(`users/${recipientId}/notifications`)
    .add({
      ...notificationData,
      recipientId: recipientId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

// Function to get denormalized sender data
const getSenderData = async (senderId: string) => {
  const userSnap = await db.collection("publicProfiles").doc(senderId).get();
  if (!userSnap.exists) {
    return {displayName: "Someone", photoURL: null};
  }
  const userData = userSnap.data()!;
  return {
    displayName: userData.displayName || "Someone",
    photoURL: userData.photoURL || null,
  };
};

// 1. Notification for new comments
export const onNewComment = onDocumentCreated(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const commentData = event.data?.data();
    const params = event.params;

    if (!commentData) {
      return;
    }

    const postSnap = await db.collection("posts").doc(params.postId).get();
    const postData = postSnap.data();

    if (!postData) {
      return;
    }

    const senderData = await getSenderData(commentData.authorId);

    const notification = {
      type: "comment",
      senderId: commentData.authorId,
      sender: senderData,
      postId: params.postId,
      postContent: postData.content?.substring(0, 50) || "",
      commentText: commentData.text?.substring(0, 50) || "",
    };

    await createNotification(postData.authorId, notification);
  },
);

// 2. Notification for new likes
export const onNewLike = onDocumentCreated(
  "posts/{postId}/likes/{userId}",
  async (event) => {
    const params = event.params;
    const senderId = params.userId;

    const postSnap = await db.collection("posts").doc(params.postId).get();
    const postData = postSnap.data();

    if (!postData) {
      return;
    }

    const senderData = await getSenderData(senderId);

    const notification = {
      type: "like",
      senderId: senderId,
      sender: senderData,
      postId: params.postId,
      postContent: postData.content?.substring(0, 50) || "",
    };

    await createNotification(postData.authorId, notification);
  },
);

// 3. Notification for new followers
export const onNewFollow = onDocumentUpdated(
  "publicProfiles/{followedId}",
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    if (!beforeData || !afterData) {
      return;
    }

    const beforeFollowers = beforeData.followerCount || 0;
    const afterFollowers = afterData.followerCount || 0;

    // Check if the follower count has increased
    if (afterFollowers > beforeFollowers) {
      // This is a simplified approach. To get the exact new follower,
      // we'd need to compare the followers array, which is costly.
      // For this implementation, we will create a generic follow notification
      // without specifying who followed. A more robust solution would be
      // to write to a dedicated `follows` collection and trigger on that.
      // Let's assume the frontend provides the new follower's ID in a separate write.

      // A better pattern: client writes to `/users/{followedId}/followers/{followerId}`
      // Then we can trigger on that `onCreate` event. Since our current logic doesn't
      // do that, we'll have to make some assumptions or change the trigger.

      // For now, let's create a placeholder to show the concept.
      // The `senderId` would ideally be the person who just followed.
      // We will need to adjust the client-side logic to get this working perfectly.
      console.log(`User ${event.params.followedId} gained a follower.`);
      // In a real app, you'd get the follower's ID to create a specific notification.
      // This function is a placeholder until the client-side write pattern is updated.
    }
  },
);
