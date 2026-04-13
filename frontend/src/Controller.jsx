import { getStoredTokens } from "./auth"

import { notificationApi } from './notificationContext';

/**
 * Utility for handling API communication with your AWS Backend.
 */

// 1. Set your AWS API Gateway / Load Balancer base URL
const BASE_URL = 'https://9uzsugp1g3.execute-api.eu-north-1.amazonaws.com';
const MATCHMAKING_URL = 'https://flb4vlp4rb.execute-api.eu-north-1.amazonaws.com/default/Matchmaking';
/**
 * The core wrapper for all fetch calls.
 * Handles headers, auth, and basic error catching.
 */
async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const tokens = getStoredTokens();

  // Initialize headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If tokens exist, add Authorization header
  if (tokens && tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    console.log(response);

    // Handle standard HTTP errors (4xx, 5xx)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.error}`);
    }

    const response_body = await response.json();
    console.log(response_body);
    //console.log(response_body.notification_piggyback)
    // parse piggybacked_notifications
    if (response_body.notification_piggyback?.status == "ok") {
      notificationApi.update(response_body.notification_piggyback.new_notifications);
    }

    // return result
    return response_body.result;
  } catch (error) {
    console.error(`API Call Failed [${options.method || 'GET'} ${path}]:`, error);
    throw error;
  }
}

// 2. Exported helper methods
export const api = {
  get: (path, options = {}) =>
    apiRequest(path, { ...options, method: 'GET' }),

  post: (path, data, options = {}) =>
    apiRequest(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }),

  put: (path, data, options = {}) =>
    apiRequest(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  delete: (path, options = {}) =>
    apiRequest(path, { ...options, method: 'DELETE' }),
};

const getProfile = async (userId) => {
  try {
    const result = await api.post('/user/getProfile', { userId });
    return result
  } catch (err) {
    //alert(err);
    throw err;
  }
}

const setName = async (name) => {
  try {
    const result = await api.post('/user/setName', { name });
    return result
  } catch (err) {
    alert(err);
  }
}

const updateUserBio = async ({ bio }) => {
  try {
    const result = await api.post('/user/updateBio', { bio });
    return result
  } catch (err) {
    alert(err);
  }
};

const updateUserResearchInterests = async ({ interests }) => {
  try {
    const result = await api.post('/user/updateResearchInterests', { interests });
    return result
  } catch (err) {
    alert(err);
  }
};

const updateUserSkills = async ({ skills }) => {
  try {
    const result = await api.post('/user/updateSkills', { skills });
    return result
  } catch (err) {
    alert(err);
  }
};

const updateUserProfile = async ({ patch }) => {
  try {
    const result = await api.post('/user/updateProfile', { patch });
    return result
  } catch (err) {
    alert(err);
  }
};

const searchProjects = async ({ filter }) => {
  try {
    console.log("in search projects api call, filter is:");
    console.log(filter);
    const result = await api.post('/project/searchProjects', { filter });
    console.log("result of search projects is:");
    console.log(result);
    return result
  } catch (err) {
    alert(err);
  }
};

const createProject = async (project) => {
  try {
    const result = await api.post('/project/createProject', { project });
    return result
  } catch (err) {
    alert(err);
  }
};

const getProjectTypes = async () => {
  try {
    const result = await api.post('/project/getProjectTypes');
    return result;
  } catch (err) {
    alert(err);
  }
};

const deleteProject = async (projectId) => {
  try {
    const result = await api.post('/project/deleteProject', { projectId });
    return result
  } catch (err) {
    alert(err);
  }
};

const getProject = async (projectId) => {
  try {
    const result = await api.post('/project/getProject', { projectId });
    return result
  } catch (err) {
    alert(err);
  }
};

const getLikedProjectsForUser = async (userId) => {
  try {
    //console.log(userId);
    const result = await api.post('/getLikedProjectsForUser', { userId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getLikeCountForProject = async (projectId) => {
  try {
    const result = await api.post('/project/getLikeCountForProject', { projectId });
    return result;
  } catch (err) {
    alert(err);
  }
};
const getUploadURL = async (fileName, fileType, fileSize, application_document_id) => {
  try {
    const result = await api.post('/file/getUploadURL', { fileName, fileType, fileSize, application_document_id });
    return result
  } catch (err) {
    alert(err);
  }
};

const getDocumentDownloadURL = async (application_document_id) => {
  try {
    const result = await api.post('/file/getDownloadURL', { application_document_id });
    return result
  } catch (err) {
    alert(err);
  }
};

const applyToProject = async (projectId, documents) => {
  try {
    const result = await api.post('/project/applyToProject', { projectId, documents });
    return result
  } catch (err) {
    console.log(err);
    alert(err);
  }
};

const hasUserAppliedToProject = async (projectId) => {
  try {
    console.log(projectId);
    const result = await api.post('/user/hasAppliedToProject', { projectId });
    return result
  } catch (err) {
    alert(err);
  }
};

const hasUserLikedProject = async (projectId) => {
  try {
    console.log(projectId);
    const result = await api.post('/user/hasLikedProject', { projectId });
    return result
  } catch (err) {
    alert(err);
  }
};

// This one is never called. I assume this WILL be used. 
const hasUserLikedPerson = async (liked_user_sub) => {
  try {
    console.log(liked_user_sub);
    const result = await api.post('/user/hasLikedPerson', { liked_user_sub });
    return result
  } catch (err) {
    alert(err);
  }
};

const getApplicantsForProject = async (projectId) => {
  try {
    const result = await api.post('/project/getApplicants', { projectId });
    return result
  } catch (err) {
    alert(err);
  }
};

const updateApplicationStatus = async (applicationId, status) => {
  try {
    const result = await api.post('/project/updateApplicationStatus', { applicationId, status });
    return result
  } catch (err) {
    alert(err);
  }
};

const listUserProjects = async (userId) => {
  try {
    const result = await api.post('/project/listUserProjects', { userId });
    return result
  } catch (err) {
    alert(err);
  }
}

const getLikedPeopleForUser = async (userId) => {

  console.log("in here with user id: ", userId);
  try {
    const result = await api.post('/getLikedPeopleForUser', { userId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const markNotificationRead = async (notificationId) => {
  try {
    const result = await api.post('/notification/markRead', { notificationId });
    return result
  } catch (err) {
    alert(err);
  }
};

const getCommentsForPaper = async (paper_id) => {
  try {
    const result = await api.post('/getCommentsForPaper', { paper_id });
    return result
  } catch (err) {
    alert(err);
  }
}

const addCommentToPaper = async (paper_id, text, user, reply_to_id) => {
  try {
    const result = await api.post('/user/addCommentToPaper', { paper_id, text, reply_to_id });
    return result
  } catch (err) {
    alert(err);
  }
}

const getPaperMetaBatch = async (paper_ids) => {
  try {
    const result = await api.post('/getPaperMetaBatch', { paper_ids });
    return result
  } catch (err) {
    alert(err);
  }
}

const hasUserLikedPaper = async (paperId) => {
  try {
    const result = await api.post('/user/hasLikedPaper', { paperId });
    return result
  } catch (err) {
    alert(err);
  }
};


const toggleLikePaper = async (paperId, topics = []) => {
  try {
    const result = await api.post('/user/toggleLikePaper', { paperId, topics });
    return result
  } catch (err) {
    alert(err);
  }
};

const getLikedPapersForUser = async (userId) => {
  try {
    console.log(userId);
    const result = await api.post('/getLikedPapersForUser', { userId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const toggleLikeProject = async (projectId) => {
  try {
    const result = await api.post('/user/toggleLikeProject', { projectId });
    return result
  } catch (err) {
    alert(err);
  }
};

const getAvatarUploadURL = async (fileType, fileSize) => {
  try {
    const result = await api.post('/user/getAvatarUploadURL', { fileType, fileSize });
    return result
  } catch (err) {
    alert(err);
  }
};

const toggleLikePerson = async (liked_user_sub) => {
  try {
    const result = await api.post('/user/toggleLikePerson', { liked_user_sub });
    return result
  } catch (err) {
    alert(err);
  }
};

const updateProject = async (projectId, project) => {
  try {
    const result = await api.post('/project/updateProject', { projectId, project });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getLikedContentForUser = async (userId) => {
  try {
    const result = await api.post('/getLikedContentForUser', { userId });
    return result;
  } catch (err) {
    alert(err);
  }
};

// const suggestOpenAlexProfile = async (openalex_id, works) => {
//   console.log(openalex_id, works);
// };

// const saveManualProfile = async (manualForm) => {
//   console.log(manualForm);
// };

const suggestOpenAlexProfile = async (openAlexId, openAlexProfile, papers, topicStats, coauthors) => {
  try {
    const result = await api.post('/user/saveOpenAlexProfile', {
      openAlexId,
      openAlexProfile,
      papers,
      topicStats,
      coauthors,
    });
    return result;
  } catch (err) {
    alert(err);
  }
};

const saveManualProfile = async (manualForm) => {
  try {
    const result = await api.post('/user/saveManualProfile', { manualForm });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getTopics = async () => {
  try {
    const result = await api.post('/project/getTopics');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getSkills = async () => {
  try {
    const result = await api.post('/project/getSkills');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getPeople = async (filters) => {
  try {
    console.log("in getPeople api call, filters is:");
    const result = await api.post('/user/getPeople', { filters });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getConnections = async () => {
  try {
    const result = await api.post('/user/getConnections');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getMatchRecommendations = async (targetSub = null) => {
  try {
    // DEMO MODE: targetSub lets you view any user's recommendations.
    // In production, remove the parameter and pass no body.
    const result = await api.post('/user/getRecommendations',
      targetSub ? { targetSub } : {}
    );
    return result;
  } catch (err) {
    alert(err);
  }
}


const searchMyProjectApplications = async (filters) => {
  try {
    const result = await api.post('/user/searchMyProjectApplications', { filters });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getPostTopics = async () => {
  try {
    const result = await api.post("/post/getPostTopics");
    return result;
  } catch (err) {
    alert(err);
  }
};

const searchPosts = async ({ filter }) => {
  try {
    const result = await api.post("/post/searchPosts", { filter });
    return result;
  } catch (err) {
    alert(err);
  }
};

const createPost = async (post) => {
  try {
    const result = await api.post("/post/createPost", { post });
    return result;
  } catch (err) {
    alert(err);
  }
};

const listUserPosts = async (userId) => {
  try {
    const result = await api.post("/post/listUserPosts", { userId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getFeedPosts = async (filter = {}) => {
  try {
    const result = await api.post("/post/getFeedPosts", { filter });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getPost = async (postId) => {
  try {
    const result = await api.post("/post/getPost", { postId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const updatePost = async (postId, post) => {
  try {
    const result = await api.post("/post/updatePost", { postId, post });
    return result;
  } catch (err) {
    alert(err);
  }
};

const deletePost = async (postId) => {
  try {
    const result = await api.post("/post/deletePost", { postId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const toggleLikePost = async (postId) => {
  try {
    return await api.post("/post/toggleLikePost", { postId });
  } catch (err) {
    alert(err);
  }
};

const getPostMetaBatch = async (postIds) => {
  try {
    return await api.post("/post/getPostMetaBatch", { postIds });
  } catch (err) {
    alert(err);
  }
};

const getCommentsForPost = async (postId) => {
  try {
    return await api.post("/post/getCommentsForPost", { postId });
  } catch (err) {
    alert(err);
  }
};

const addCommentToPost = async (postId, text, replyToId = null) => {
  try {
    return await api.post("/post/addCommentToPost", {
      postId,
      text,
      replyToId,
    });
  } catch (err) {
    alert(err);
  }
};

const getLikedPostsForUser = async (userId) => {
  try {
    return await api.post("/getLikedPostsForUser", { userId });
  } catch (err) {
    alert(err);
  }
};

const searchEvents = async ({ filter }) => {
  try {
    const result = await api.post('/event/searchEvents', { filter });
    return result;
  } catch (err) {
    alert(err);
  }
};

const createEvent = async (event) => {
  try {
    const result = await api.post('/event/createEvent', { event });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getEvent = async (eventId) => {
  try {
    const result = await api.post('/event/getEvent', { eventId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const updateEvent = async (eventId, event) => {
  try {
    const result = await api.post('/event/updateEvent', { eventId, event });
    return result;
  } catch (err) {
    alert(err);
  }
};

const deleteEvent = async (eventId) => {
  try {
    const result = await api.post('/event/deleteEvent', { eventId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const registerForEvent = async (eventId) => {
  try {
    const result = await api.post('/event/registerForEvent', { eventId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const unregisterFromEvent = async (eventId) => {
  try {
    const result = await api.post('/event/unregisterFromEvent', { eventId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const hasUserRegisteredToEvent = async (eventId) => {
  try {
    const result = await api.post('/event/hasUserRegisteredToEvent', { eventId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const listMyEvents = async () => {
  try {
    const result = await api.post('/event/listMyEvents');
    return result;
  } catch (err) {
    alert(err);
  }
};

const listRegisteredEvents = async () => {
  try {
    const result = await api.post('/event/listRegisteredEvents');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getEventTopics = async () => {
  try {
    const result = await api.post('/event/getEventTopics');
    return result;
  } catch (err) {
    alert(err);
  }
};

const listUserEvents = async (userId) => {
  try {
    const result = await api.post('/event/listUserEvents', { userId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const deleteComment = async ({ comment_id }) => {
  try {
    const result = await api.post('/user/deleteComment', { comment_id });
    return result;
  } catch (err) {
    alert(err);
  }
};

const editComment = async ({ comment_id, text }) => {
  try {
    const result = await api.post('/user/editComment', { comment_id, text });
    return result;
  } catch (err) {
    alert(err);
  }
};

const editCommentOnPost = async ({ commentId, text }) => {
  try {
    const result = await api.post('/post/editCommentOnPost', { commentId, text });
    return result;
  } catch (err) {
    alert(err);
  }
};

const deleteCommentFromPost = async ({ commentId }) => {
  try {
    const result = await api.post('/post/deleteCommentFromPost', { commentId });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getLocations = async (query) => {
  try {
    const result = await api.post('/project/getLocations', { query });
    return result;
  } catch (err) {
    alert(err);
  }
};

const getInstitutes = async (query) => {
  try {
    const result = await api.post('/project/getInstitutes', { query });
    return result;
  } catch (err) {
    alert(err);
  }
};


const getInstituteVerificationDomain = async () => {
  try {
    const result = await api.post('/verify/getInstituteVerificationDomain', {});
    return result;
  } catch (err) {
    alert(err);
  }
}

const shareInstituteMailName = async (name, chosenDomain) => {
  try {
    const result = await api.post('/verify/requestMagicCode', { name, chosenDomain });
    return result;
  } catch (err) {
    alert(err);
  }
}

const submitMagicCode = async (magicCode) => {
  try {
    const result = await api.post('/verify/submitMagicCode', { magicCode });
    return result;
  } catch (err) {
    alert(err);
  }
}

const getProjectsPageData = async (filter) => {
  try {
    const result = await api.post('/project/getProjectsPageData', { filter });
    console.log("got projects page data: ", result);
    return result;
  } catch (err) {
    alert(err);
  }
};

const validateSignOn = async () => {
  try {
    const result = await api.post('/user/validateSignOn', { });
    return result;
  } catch (err) {
    alert(err);
  }
}

const getLanguages = async () => {
  try {
    const result = await api.post('/user/getLanguages');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getTitles = async () => {
  try {
    const result = await api.post('/user/getTitles');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getFields = async () => {
  try {
    const result = await api.post('/user/getFields');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getPositionTitles = async () => {
  try {
    const result = await api.post('/user/getPositionTitles');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getPositionFields = async () => {
  try {
    const result = await api.post('/user/getPositionFields');
    return result;
  } catch (err) {
    alert(err);
  }
};

const getAllRequiredInformationForUserPage = async (userId) => {
  try {
    return await api.post('/user/getAllRequiredInformationForUserPage', { userId });
  } catch (err) {
    alert(err);
    throw err;
  }
};

const getTopTopicScores = async (limit = 10) => {
  try {
    return await api.post('/user/getTopTopicScores', { limit });
  } catch (err) {
    alert(err);
  }
};

const getRecommendedProjects = async (page = 1, results_per_page = 10) => {
  try {
    return await api.post('/project/getRecommendedProjects', { page, results_per_page });
  } catch (err) {
    alert(err);
    throw err;
  }
};

const createReport = async ({ reportedItemType, reportedItemId, reportNote }) => {
  try {
    const result = await api.post("/user/createReport", {
      reportedItemType,
      reportedItemId,
      reportNote,
    });
    return result;
  } catch (err) {
    alert(err?.message || "Failed to submit report.");
    throw err;
  }
};

const deleteUser = async () => {
  try {
    const result = await api.post('/user/deleteUser', {});
    return result;
  } catch (err) {
    alert(err?.message || "Failed to delete profile.");
    throw err;
  }
};

export {
  deleteUser,
  createReport,
  getRecommendedProjects,
  getTopTopicScores,
  getAllRequiredInformationForUserPage,
  getPositionTitles,
  getPositionFields,
  getTitles,
  getFields,
  getLanguages,
  getInstituteVerificationDomain,
  validateSignOn,
  shareInstituteMailName,
  submitMagicCode,
  getProjectsPageData,
  getInstitutes,
  getLocations,
  editComment,
  deleteComment,
  editCommentOnPost,
  deleteCommentFromPost,
  listUserEvents,
  searchEvents,
  createEvent,
  getEvent,
  updateEvent,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
  hasUserRegisteredToEvent,
  listMyEvents,
  listRegisteredEvents,
  getEventTopics,
  getLikedPostsForUser,
  toggleLikePost,
  getPostMetaBatch,
  getCommentsForPost,
  addCommentToPost,
  getPostTopics,
  searchPosts,
  createPost,
  listUserPosts,
  getPost,
  updatePost,
  deletePost,
  getFeedPosts,
  searchMyProjectApplications,
  getPeople,
  getConnections,
  getTopics,
  getSkills,
  suggestOpenAlexProfile,
  saveManualProfile,
  updateProject,
  searchProjects,
  applyToProject,
  getUploadURL,
  getAvatarUploadURL,
  getDocumentDownloadURL,
  markNotificationRead,
  getApplicantsForProject,
  hasUserAppliedToProject,
  updateApplicationStatus,
  hasUserLikedPaper,
  toggleLikeProject,
  hasUserLikedProject,
  getLikeCountForProject,
  createProject,
  deleteProject,
  getProject,
  listUserProjects,
  getLikedProjectsForUser,
  getPaperMetaBatch,
  toggleLikePaper,
  getLikedPapersForUser,
  getCommentsForPaper,
  addCommentToPaper,
  toggleLikePerson,
  hasUserLikedPerson,
  getLikedPeopleForUser,
  getLikedContentForUser,
  updateUserBio,
  updateUserResearchInterests,
  updateUserSkills,
  updateUserProfile,
  setName,
  getProfile,
  getProjectTypes,
  getMatchRecommendations
};
