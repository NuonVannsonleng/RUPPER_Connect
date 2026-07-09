const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const allowedFrontends = () =>
  (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || "",
  avatar: u.avatar || "",
  studentId: u.student_id || "",
  major: u.major || "",
  year: u.year || "",
  department: u.department || "",
  office: u.office || "",
});

const makeToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "dev_secret", {
    expiresIn: "7d",
  });

const getBackendUrl = (req) => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, "");
  const proto = req.get("x-forwarded-proto") || req.protocol;
  return `${proto}://${req.get("host")}`;
};

const getFrontendOrigin = (requestedOrigin) => {
  const origins = allowedFrontends();
  if (requestedOrigin && origins.includes(requestedOrigin)) return requestedOrigin;
  return origins[0] || "http://localhost:8080";
};

const redirectWithError = (res, frontendOrigin, message) => {
  const params = new URLSearchParams({ error: message });
  return res.redirect(`${frontendOrigin}/oauth/callback?${params.toString()}`);
};

const getProvider = (provider) => {
  const microsoftTenant = process.env.MICROSOFT_TENANT_ID || "common";

  const providers = {
    google: {
      label: "Google",
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
      scope: "openid email profile",
      authExtras: { prompt: "select_account", access_type: "offline" },
    },
    facebook: {
      label: "Facebook",
      clientId: process.env.FACEBOOK_OAUTH_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_OAUTH_CLIENT_SECRET,
      authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
      userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email,picture",
      scope: "email,public_profile",
      authExtras: { auth_type: "rerequest" },
    },
    apple: {
      label: "Apple",
      clientId: process.env.APPLE_OAUTH_CLIENT_ID,
      clientSecret: process.env.APPLE_OAUTH_CLIENT_SECRET,
      authUrl: "https://appleid.apple.com/auth/authorize",
      tokenUrl: "https://appleid.apple.com/auth/token",
      scope: "name email",
      authExtras: { response_mode: "form_post" },
    },
    microsoft: {
      label: "Microsoft",
      clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
      authUrl: `https://login.microsoftonline.com/${microsoftTenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${microsoftTenant}/oauth2/v2.0/token`,
      userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
      scope: "openid email profile User.Read",
      authExtras: { prompt: "select_account" },
    },
  };

  return providers[provider];
};

const postForm = async (url, values) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error_description || data.error || "OAuth token exchange failed");
  return data;
};

const getJson = async (url, accessToken) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || "OAuth profile request failed");
  return data;
};

const decodeJwtPayload = (token) => {
  const payload = token.split(".")[1];
  if (!payload) return {};
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
};

const getProfile = async (providerName, provider, tokenData) => {
  if (providerName === "apple") {
    const payload = decodeJwtPayload(tokenData.id_token || "");
    return {
      email: payload.email,
      name: payload.name || (payload.email ? payload.email.split("@")[0] : "Apple User"),
      avatar: "",
    };
  }

  const profile = await getJson(provider.userInfoUrl, tokenData.access_token);

  if (providerName === "facebook") {
    return {
      email: profile.email,
      name: profile.name || "Facebook User",
      avatar: profile.picture?.data?.url || "",
    };
  }

  if (providerName === "microsoft") {
    return {
      email: profile.email || profile.preferred_username,
      name: profile.name || profile.email || "Microsoft User",
      avatar: "",
    };
  }

  return {
    email: profile.email,
    name: profile.name || profile.email || "Google User",
    avatar: profile.picture || "",
  };
};

const findOrCreateUser = async ({ email, name, avatar, role }) => {
  if (!email) {
    const error = new Error("This provider did not return an email address.");
    error.status = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [normalizedEmail]);

  if (existing.length) {
    const user = existing[0];
    if (user.role !== role) {
      const error = new Error(`This email is already registered as ${user.role}.`);
      error.status = 409;
      throw error;
    }

    if ((avatar && !user.avatar) || (name && user.name !== name)) {
      await pool.query("UPDATE users SET name = ?, avatar = COALESCE(avatar, ?) WHERE id = ?", [
        name || user.name,
        avatar || null,
        user.id,
      ]);
      const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [user.id]);
      return rows[0];
    }

    return user;
  }

  const placeholderPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)",
    [name || normalizedEmail.split("@")[0], normalizedEmail, placeholderPassword, role, avatar || null]
  );
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
  return rows[0];
};

exports.startOAuth = async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  const frontendOrigin = getFrontendOrigin(req.query.frontendOrigin);

  if (!provider) return redirectWithError(res, frontendOrigin, "Unsupported social login provider.");
  if (!provider.clientId || !provider.clientSecret) {
    return redirectWithError(res, frontendOrigin, `${provider.label} OAuth is not configured yet.`);
  }

  const role = ["student", "teacher"].includes(req.query.role) ? req.query.role : "student";
  const rememberMe = req.query.rememberMe !== "false";
  const redirectUri = `${getBackendUrl(req)}/api/auth/oauth/${providerName}/callback`;
  const state = jwt.sign(
    { provider: providerName, role, rememberMe, frontendOrigin },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: "10m" }
  );

  const authUrl = new URL(provider.authUrl);
  authUrl.search = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: provider.scope,
    state,
    ...provider.authExtras,
  }).toString();

  return res.redirect(authUrl.toString());
};

exports.oauthStatus = async (req, res) => {
  const providers = ["google", "facebook", "apple", "microsoft"];
  const status = providers.reduce((acc, providerName) => {
    const provider = getProvider(providerName);
    acc[providerName] = Boolean(provider?.clientId && provider?.clientSecret);
    return acc;
  }, {});

  res.json({ providers: status });
};

exports.handleOAuthCallback = async (req, res) => {
  const providerName = req.params.provider;
  const provider = getProvider(providerName);
  const code = req.query.code || req.body.code;
  const stateToken = req.query.state || req.body.state;

  let state;
  try {
    state = jwt.verify(stateToken, process.env.JWT_SECRET || "dev_secret");
  } catch {
    return redirectWithError(res, getFrontendOrigin(), "OAuth session expired. Please try again.");
  }

  const frontendOrigin = getFrontendOrigin(state.frontendOrigin);

  try {
    if (!provider || state.provider !== providerName) throw new Error("Invalid OAuth provider.");
    if (!code) throw new Error("OAuth provider did not return an authorization code.");

    const redirectUri = `${getBackendUrl(req)}/api/auth/oauth/${providerName}/callback`;
    const tokenData = await postForm(provider.tokenUrl, {
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const profile = await getProfile(providerName, provider, tokenData);
    const user = await findOrCreateUser({ ...profile, role: state.role });
    const params = new URLSearchParams({
      token: makeToken(user),
      rememberMe: String(state.rememberMe),
    });

    return res.redirect(`${frontendOrigin}/oauth/callback?${params.toString()}`);
  } catch (error) {
    return redirectWithError(res, frontendOrigin, error.message || "OAuth login failed.");
  }
};
