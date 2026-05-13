import userService from '../services/userService.js';

export const postAuthHandler = async (event) => {
    console.log("PostAuthentication Event:", JSON.stringify(event, null, 2));

    const { sub, email, name } = event.request.userAttributes;

    try {
        // This will INSERT if missing, or UPDATE if they already exist
        await userService.createUser({
            cognitoId: sub,
            email: email,
            name: name || null 
        });

        return event;
    } catch (error) {
        console.error("Error in PostAuthentication sync:", error);
        throw error;
    }
};

export const confirmHandler = async (event) => {
    // event.triggerSource will be "PostConfirmation_ConfirmSignUp"
    console.log("PostConfirmation Event:", JSON.stringify(event, null, 2));

    const { sub, email, name } = event.request.userAttributes;

    try {
        // Add user to your DB via your existing service
        // 'sub' is the unique Cognito ID you'll use to link records
        await userService.createUser({
            cognitoId: sub,
            email: email,
            name: name || null 
        });

        // Return the event to Cognito to signal success
        return event;
    } catch (error) {
        console.error("Error saving user to DB:", error);
        // If you throw an error here, the user's confirmation will fail
        throw error; 
    }
};