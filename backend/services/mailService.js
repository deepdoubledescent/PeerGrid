import db from '../db.js';
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: "eu-north-1" });

const institutionDomainTranslator = (instId) => {
    // Strip the URL prefix just in case the API returns the full URL
    const cleanId = instId.replace('https://openalex.org/', '');
    
    // Example mapping
    const domainMap = {
        "I8087733": 'uni-tuebingen.de',
        "I4210094118": 'uni-tuebingen.de',
        "I4210133934": 'bccn-tuebingen.de',
        "I3019120314": 'bgu-tuebingen.de',
        "I4210115702": 'humangenetik-tuebingen.de',
        "I4401726832": 'uni-tuebingen.de',
        "I4210135521": 'mpg.de',
        "I4210112925": 'mpg.de',
        "I4210165766": 'mpg.de'
    };

    return domainMap[cleanId] || null;
}

const institutionNameDomainTranslator = (name) => {
    if (!name) return null;
    
    // Example mapping (make sure to lowercase for safe comparisons)
    const cleanName = name.toLowerCase().trim();
    console.log(cleanName);
    const domainMap = {
        "university of tübingen": 'uni-tuebingen.de',
        "universitätsklinikum tübingen": 'uni-tuebingen.de',
        "bernstein center for computational neuroscience tübingen": 'bccn-tuebingen.de',
        "bg klinik tübingen": 'bgu-tuebingen.de',
        "praxis für humangenetik tübingen": 'humangenetik-tuebingen.de',
        "tübingen ai center": 'uni-tuebingen.de',
        "max planck institute for intelligent systems": 'mpg.de',
        "max planck institute for biological cybernetics": 'mpg.de',
        "max planck institute for biology": 'mpg.de'
    };

    return domainMap[cleanName] || null;
}


export const getInstituteVerificationDomain = async (userId) => {
    try {
        // 1. Get BOTH OpenAlex ID and manual Institution Name in one query
        const userQuery = `
            SELECT u.openalex_id, i.institution_name 
            FROM Users u 
            LEFT JOIN Institutions i ON u.institution_id = i.institution_id 
            WHERE u.cognito_sub = ?
        `;
        const [userResults] = await db.execute(userQuery, [userId]);

        if (!userResults || userResults.length === 0) {
            console.log("No user record found for:", userId);
            return []; 
        }

        const { openalex_id, institution_name } = userResults[0];
        const validDomains = new Set(); // Use a Set to prevent duplicates

        // 2. Determine which workflow to use
        if (openalex_id) {
            // --- PATH A: The OpenAlex API Workflow ---
            const openAlexIdClean = openalex_id.split('/').pop();
            const response = await fetch(`https://api.openalex.org/authors/${openAlexIdClean}?mailto=admin@peer-grid.de`);
            
            if (!response.ok) {
                throw new Error(`OpenAlex API responded with status: ${response.status}`);
            }
            
            const authorData = await response.json();
            const institutionIds = new Set();

            if (authorData.affiliations && Array.isArray(authorData.affiliations)) {
                authorData.affiliations.forEach(affil => {
                    if (affil.institution?.id) {
                        institutionIds.add(affil.institution.id);
                    }
                    if (affil.institution?.lineage && Array.isArray(affil.institution.lineage)) {
                        affil.institution.lineage.forEach(lineageId => institutionIds.add(lineageId));
                    }
                });
            }

            for (const instId of institutionIds) {
                const domain = institutionDomainTranslator(instId);
                if (domain) validDomains.add(domain);
            }

        } else if (institution_name) {
            // --- PATH B: The Manual Institution Workflow ---
            const domain = institutionNameDomainTranslator(institution_name);
            if (domain) {
                validDomains.add(domain);
            }
        } else {
            // User has no OpenAlex profile AND no manual institution
            console.log("No OpenAlex ID or institution name found for user:", userId);
            return [];
        }

        // 3. Convert the Set to an Array
        const domainList = Array.from(validDomains);

        // 4. Store all allowed domains in AffiliatedInstitutions table
        if (domainList.length > 0) {
            const placeholders = domainList.map(() => '(?, ?)').join(', ');
            const insertValues = domainList.flatMap(domain => [userId, domain]);

            const insertQuery = `
                INSERT IGNORE INTO AffiliatedInstitutions (cognito_sub, domain) 
                VALUES ${placeholders}
            `;
            
            await db.execute(insertQuery, insertValues);
            console.log(`Saved ${domainList.length} domains for user ${userId}`);
        }

        // 5. Return the list of allowed domains
        return domainList;

    } catch (err) {
        console.error("Error fetching institute verification domains:", err);
        return [];
    }
};

const sendViaSES = async(toMail, magicCode) => {
    // 4. Send the email via SES
    const params = {
        Source: "REDACTED", // MUST be verified in AWS SES
        Destination: { 
            ToAddresses: [toMail] // MUST also be verified if in SES Sandbox
        },
        Message: {
            Subject: { 
                Data: "Verify your Peer Grid Profile" 
            },
            Body: { 
                Html: { 
                    Data: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Peer Grid Verification</h2>
                            <p>Your magic verification code is:</p>
                            <h1 style="letter-spacing: 0.2em; color: #003d82;">${magicCode}</h1>
                            <p>This code will expire in 2 hours.</p>
                            <p>If you did not request this, you can safely ignore this email.</p>
                        </div>
                    ` 
                },
                Text: { 
                    Data: `Your verification code is: ${magicCode}. It will expire in 2 hours.` 
                }
            }
        }
    };

    return await ses.send(new SendEmailCommand(params));
}

const sendViaResend = async(toMail, magicCode) => {
    const resendToken = 'REDACTED'; //USMAN: change

    // Prepare the payload for Resend
    const emailPayload = {
        from: 'Peer Grid <noreply@peer-grid.de>', //USMAN: change
        to: [toMail],
        subject: "Verify your Peer Grid Profile",
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Peer Grid Verification</h2>
                <p>Your magic verification code is:</p>
                <h1 style="letter-spacing: 0.2em; color: #003d82;">${magicCode}</h1>
                <p>This code will expire in 2 hours.</p>
                <p>If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
        text: `Your verification code is: ${magicCode}. It will expire in 2 hours.`
    };

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendToken}`
        },
        body: JSON.stringify(emailPayload)
    });

    return await response.json();
}

export const sendMagicCode = async (userId, username, selectedDomain) => {
    try {
        // 1. Verify the domain belongs to this user
        const verifyQuery = `
            SELECT 1 FROM AffiliatedInstitutions 
            WHERE cognito_sub = ? AND domain = ?
        `;
        const [authRows] = await db.execute(verifyQuery, [userId, selectedDomain]);

        if (authRows.length === 0) {
            throw new Error("Unauthorized: This domain is not linked to your OpenAlex profile.");
        }

        // 2. Construct the email address
        // Clean the inputs to avoid accidental whitespace or case issues
        const cleanUsername = username.trim().toLowerCase();
        const emailAddress = `${cleanUsername}${selectedDomain}`;

        // 3. Generate and store the magic code
        const magicCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

        // Upsert: If the user already has a code pending, overwrite it and reset the 2-hour timer
        const insertCodeQuery = `
            INSERT INTO MagicCodes (cognito_sub, email, code, valid_until) 
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))
            ON DUPLICATE KEY UPDATE 
                email = VALUES(email),
                code = VALUES(code), 
                valid_until = VALUES(valid_until)
        `;
        await db.execute(insertCodeQuery, [userId, emailAddress, magicCode]);

        await sendViaResend(emailAddress, magicCode);
        
        console.log(`Successfully sent magic code to ${emailAddress}`);
        return { success: true, message: "Magic code sent successfully" };

    } catch (err) {
        console.error("Error in sendMagicCode:", err);
        // Throwing the error allows your Express route (or Lambda handler) 
        // to catch it and return a 400/500 to the frontend
        throw new Error(err.message || "Failed to send magic code.");
    }
};

export const verifyMagicCode = async (userId, code) => {
    try {
        // 1. Fetch the code AND the associated email for this specific user
        const query = `
            SELECT valid_until, email 
            FROM MagicCodes 
            WHERE cognito_sub = ? AND code = ?
        `;
        const [rows] = await db.execute(query, [userId, code]);

        // 2. If no record matches, the code is wrong
        if (rows.length === 0) {
            return false;
        }

        const validUntil = new Date(rows[0].valid_until);
        const verifiedEmail = rows[0].email;
        const now = new Date();

        // 3. Check if the code has expired
        if (validUntil < now) {
            // Clean up the expired code
            await db.execute('DELETE FROM MagicCodes WHERE cognito_sub = ?', [userId]);
            return false;
        }

        // 4. Success! Update the Users table
        const updateUserQuery = `
            UPDATE Users 
            SET verified = TRUE, verified_email = ? 
            WHERE cognito_sub = ?
        `;
        await db.execute(updateUserQuery, [verifiedEmail, userId]);

        // 5. Delete the code so it is strictly single-use
        await db.execute('DELETE FROM MagicCodes WHERE cognito_sub = ?', [userId]);

        return true;

    } catch (err) {
        console.error("Error in verifyMagicCode:", err);
        return false; // Fail securely
    }
};
