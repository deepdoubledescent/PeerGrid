// auth.js - AWS Cognito Authentication Configuration

import { getProfile } from "./Controller";

const COGNITO_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  clientSecret: import.meta.env.VITE_COGNITO_CLIENT_SECRET,
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
};

// ============================================
// SECRET HASH COMPUTATION
// ============================================

async function computeSecretHash(username) {
  if (!COGNITO_CONFIG.clientSecret) {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(COGNITO_CONFIG.clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = encoder.encode(username + COGNITO_CONFIG.clientId);
  const signature = await crypto.subtle.sign('HMAC', key, message);

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ============================================
// GOOGLE OAUTH
// ============================================

export function getGoogleLoginUrl() {
  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: COGNITO_CONFIG.redirectUri,
    identity_provider: "Google",
  });

  return `${COGNITO_CONFIG.domain}/oauth2/authorize?${params.toString()}`;
}


export async function exchangeCodeForTokens(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CONFIG.clientId,
    code: code,
    redirect_uri: COGNITO_CONFIG.redirectUri,
  });

  if (COGNITO_CONFIG.clientSecret) {
    params.append("client_secret", COGNITO_CONFIG.clientSecret);
  }

  const response = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json(); // Use .json() instead of .text()
    console.error("Cognito Error Details:", errorData);
    throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
  }

  return await response.json();
}

// ============================================
// TOKEN UTILITIES
// ============================================

export function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
}

export async function getUserFromIdToken(idToken) {

  // Hack: Ignore stuff in the id token and just query our backend #getProfile func (controller)

  try {
    console.log("getting Profile in auth.js");
    const user = await getProfile();
    console.log(user);
    return user;
  } catch (e) {
    console.log("bad tokens");
    clearTokens();
    alert("Please sign in again.");
  }

/*   const decoded = parseJwt(idToken);
  if (!decoded) return null;

  // Build name from available fields (handles both email/password and Google OAuth)
  let name = decoded.name;
  if (!name && (decoded.given_name || decoded.family_name)) {
    name = `${decoded.given_name || ''} ${decoded.family_name || ''}`.trim();
  }
  if (!name) {
    name = decoded.email?.split("@")[0] || "User";
  }

  return {
    id: decoded.sub,
    email: decoded.email,
    name: name,
    firstName: decoded.given_name || null,
    lastName: decoded.family_name || null,
    picture: decoded.picture || null,
    emailVerified: decoded.email_verified,
  }; */
}

export function storeTokens(tokens) {
  localStorage.setItem("cognito_id_token", tokens.id_token);
  localStorage.setItem("cognito_access_token", tokens.access_token);
  localStorage.setItem("cognito_refresh_token", tokens.refresh_token || "");
  localStorage.setItem("cognito_expires_at", String(Date.now() + tokens.expires_in * 1000));
}

export function getStoredTokens() {
  const idToken = localStorage.getItem("cognito_id_token");
  const accessToken = localStorage.getItem("cognito_access_token");
  const refreshToken = localStorage.getItem("cognito_refresh_token");
  const expiresAt = localStorage.getItem("cognito_expires_at");

  if (!idToken || !accessToken) return null;

  if (expiresAt && Date.now() > parseInt(expiresAt)) {
    clearTokens();
    return null;
  }

  return { idToken, accessToken, refreshToken, expiresAt };
}

export function clearTokens() {
  localStorage.removeItem("cognito_id_token");
  localStorage.removeItem("cognito_access_token");
  localStorage.removeItem("cognito_refresh_token");
  localStorage.removeItem("cognito_expires_at");
}

export function getLogoutUrl() {
  const params = new URLSearchParams({
    client_id: COGNITO_CONFIG.clientId,
    logout_uri: COGNITO_CONFIG.redirectUri,
  });

  return `${COGNITO_CONFIG.domain}/logout?${params.toString()}`;
}

export async function refreshTokens(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: COGNITO_CONFIG.clientId,
    refresh_token: refreshToken,
  });

  if (COGNITO_CONFIG.clientSecret) {
    params.append("client_secret", COGNITO_CONFIG.clientSecret);
  }

  const response = await fetch(`${COGNITO_CONFIG.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error("Token refresh failed");
  }

  const tokens = await response.json();
  storeTokens({ ...tokens, refresh_token: refreshToken });
  return tokens;
}

export function isAuthenticated() {
  const tokens = getStoredTokens();
  return tokens !== null;
}

export function getCurrentUser() {
  const tokens = getStoredTokens();
  if (!tokens) return null;
  return getUserFromIdToken(tokens.idToken);
}

// ============================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================

export async function signUpWithEmail(email, password, firstName, lastName) {
  const secretHash = await computeSecretHash(email);

  const fullName = `${firstName} ${lastName}`.trim();

  const body = {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: fullName },
      { Name: "given_name", Value: firstName },
      { Name: "family_name", Value: lastName },
    ],
  };

  if (secretHash) {
    body.SecretHash = secretHash;
  }

  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Sign up failed");
  }

  return data;
}

export async function confirmSignUp(email, code) {
  const secretHash = await computeSecretHash(email);

  const body = {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    ConfirmationCode: code,
  };

  if (secretHash) {
    body.SecretHash = secretHash;
  }

  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Confirmation failed");
  }

  return data;
}

export async function resendConfirmationCode(email) {
  const secretHash = await computeSecretHash(email);

  const body = {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
  };

  if (secretHash) {
    body.SecretHash = secretHash;
  }

  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ResendConfirmationCode",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Failed to resend code");
  }

  return data;
}

export async function signInWithEmail(email, password) {
  const secretHash = await computeSecretHash(email);

  const authParameters = {
    USERNAME: email,
    PASSWORD: password,
  };

  if (secretHash) {
    authParameters.SECRET_HASH = secretHash;
  }

  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
      body: JSON.stringify({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: COGNITO_CONFIG.clientId,
        AuthParameters: authParameters,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Sign in failed");
  }

  if (data.AuthenticationResult) {
    const tokens = {
      id_token: data.AuthenticationResult.IdToken,
      access_token: data.AuthenticationResult.AccessToken,
      refresh_token: data.AuthenticationResult.RefreshToken,
      expires_in: data.AuthenticationResult.ExpiresIn,
    };
    storeTokens(tokens);
    return { tokens, user: await getUserFromIdToken(tokens.id_token, false) };
  }

  return data;
}

export async function forgotPassword(email) {
  const secretHash = await computeSecretHash(email);

  const body = {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
  };

  if (secretHash) {
    body.SecretHash = secretHash;
  }

  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ForgotPassword",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Failed to initiate password reset");
  }

  return data;
}

export async function confirmForgotPassword(email, code, newPassword) {
  const secretHash = await computeSecretHash(email);

  const body = {
    ClientId: COGNITO_CONFIG.clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  };

  if (secretHash) {
    body.SecretHash = secretHash;
  }

  const response = await fetch(
    `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmForgotPassword",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.__type || "Failed to reset password");
  }

  return data;
}
