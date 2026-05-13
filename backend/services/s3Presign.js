import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import db from '../db.js';

const s3Client = new S3Client({ region: "eu-north-1" });

export const documentGetPresignedPutURL = async (fileName, fileType, fileSize, documentId, cognito_sub) => {

    const bucketName = "REDACTED";
    const objectKey = `REDACTED`;

    // Create the S3 Command
    // We "lock" the Content-Length and Content-Type into the signature
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: fileType,
        ContentLength: fileSize, 
    });

    try {
        // Generate the URL (valid for 5 minutes)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // Logic for RDS (Save the link/key now or after upload)
        const fileUrl = `https://${bucketName}.s3.amazonaws.com/${objectKey}`;
        const query = `
        INSERT INTO Project_Application_Documents (URI, document_id, pending, cognito_sub, size, name)
        VALUES (?, ?, ?, ?, ?, ?)
        `;

        console.log(fileUrl, documentId, cognito_sub);

        const [results] = await db.execute(query, [fileUrl, documentId, true, cognito_sub, fileSize, fileName]);

        console.log(results);

        return { url: uploadUrl, application_document_id: results.insertId };
    } catch (err) {
        console.log(err);
        return null;
    }
};

export const avatarGetPresignedPutURL = async (fileType, fileSize, cognito_sub) => {

    const bucketName = "REDACTED";
    const objectKey = `REDACTED`;

    // Create the S3 Command
    // We "lock" the Content-Length and Content-Type into the signature
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: fileType,
        ContentLength: fileSize, 
    });

    try {
        // Generate the URL (valid for 5 minutes)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // Logic for RDS (Save the link/key now or after upload)
        const fileUrl = `https://${bucketName}.s3.amazonaws.com/${objectKey}`;
        const query = 'UPDATE Users SET avatar = ? WHERE cognito_sub = ?';

        const [results] = await db.execute(query, [fileUrl, cognito_sub]);

        return { url: uploadUrl, publicUrl: fileUrl };
    } catch (err) {
        console.log(err);
        return null;
    }
};

export const documentGetPresignedGetURL = async (application_document_id, cognito_sub) => {

    // Look up the S3 URI/Key in MySQL
    const [rows] = await db.execute(`
        SELECT pad.*
        FROM Project_Application_Documents pad
        LEFT JOIN Project_Applications pa ON pad.application_id = pa.application_id
        LEFT JOIN Projects p ON pa.project_id = p.project_id
        WHERE pad.project_application_document_id = ?
        AND (
            pad.cognito_sub = ?
            OR 
            p.cognito_sub = ?
        );`,
        [application_document_id, cognito_sub, cognito_sub]
    );

    if (rows.length === 0) {
        // document does not exist or user has no permission to access
        null;
    }

    const fullUri = rows[0].uri; 

    console.log(fullUri);
    
    // Extract the key from the URI 
    // URI format: https://bucket-name.s3.amazonaws.com/uploads/filename.pdf
    const urlParts = new URL(fullUri);
    const bucketName = urlParts.hostname.split('.')[0];
    const objectKey = decodeURIComponent(urlParts.pathname.substring(1));

    // Generate the Presigned GET URL
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ResponseContentDisposition: "attachment",
    });

    console.log(bucketName, objectKey);

    try {
        // Generate the URL
        const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });

        return { url: url };
    } catch (err) {
        return null;
    }
};