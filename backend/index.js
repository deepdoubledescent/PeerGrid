// src/index.js
import userService from './services/userService.js';
import projectService from './services/projectService.js';
import notificationService from './services/notificationService.js';
import generalService from './services/generalService.js';
import postService from './services/postService.js';
import eventService from './services/eventService.js';
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { documentGetPresignedPutURL, documentGetPresignedGetURL, avatarGetPresignedPutURL } from './services/s3Presign.js';
import { getInstituteVerificationDomain, sendMagicCode, verifyMagicCode } from './services/mailService.js';


const verifier = CognitoJwtVerifier.create({
    userPoolId: "REDACTED",
    tokenUse: "REDACTED",
    clientId: "REDACTED",
})

const ROUTES = {
  '/health': { auth: 'public' },
  '/user/getProfile': { auth: 'optional' },
  '/user/updateBio': { auth: 'private' },
  '/user/updateSkills': { auth: 'private' },
  '/user/updateResearchInterests': { auth: 'private' },
  '/user/updateProfile': { auth: 'private' },
  '/project/searchProjects': { auth: 'optional' },
  '/project/createProject': { auth: 'private' },
  '/project/deleteProject': { auth: 'private' },
  '/project/getProject': { auth: 'optional' },
  '/getLikedProjectsForUser': { auth: 'private' },
  '/project/getLikeCountForProject': { auth: 'public' },
  '/user/hasAppliedToProject': { auth: 'private' },
  '/file/getUploadURL': { auth: 'private' },
  '/file/getDownloadURL': { auth: 'private' },
  '/project/applyToProject': { auth: 'private' },
  '/user/hasLikedProject': { auth: 'private' },
  '/user/hasLikedPerson': { auth: 'private' },
  '/project/getApplicants': { auth: 'private' },
  '/project/updateApplicationStatus': { auth: 'private' },
  '/project/listUserProjects': { auth: 'optional' },
  '/getLikedPeopleForUser': { auth: 'public' },
  '/notification/markRead': { auth: 'private' },
  '/getCommentsForPaper': { auth: 'public'},
  '/user/addCommentToPaper': { auth: 'private' },
  '/user/editComment': { auth: 'private' },
  '/getPaperMetaBatch': { auth: 'optional' },
  '/user/hasLikedPaper': { auth: 'private' },
  '/user/toggleLikePaper': { auth: 'private' },
  '/getLikedPapersForUser': { auth: 'public' },
  '/user/toggleLikeProject': { auth: 'private' },
  '/user/getAvatarUploadURL': { auth: 'private' },
  '/user/toggleLikePerson': { auth: 'private' },
  '/project/getProjectTypes': { auth: 'optional' },
  '/project/updateProject': { auth: 'private' },
  '/project/getTopics': { auth: 'public' },
  '/project/getSkills': { auth: 'public' },
  '/user/getPeople': { auth: 'private' },
  '/user/getConnections': { auth: 'private' },
  '/user/getFollowing': { auth: 'private' },
  '/user/getRecommendations': { auth: 'private' },
  '/user/searchMyProjectApplications': { auth: 'private' },
  '/project/getInstitutes': { auth: 'public' },
  '/post/getPostTopics': { auth: 'public' },
  '/post/searchPosts': { auth: 'optional' },
  '/post/listUserPosts': { auth: 'optional' },
  '/post/getFeedPosts': { auth: 'private' },
  '/post/createPost': { auth: 'private' },
  '/post/getPost': { auth: 'optional' },
  '/post/updatePost': { auth: 'private' },
  '/post/deletePost': { auth: 'private' },
  '/post/toggleLikePost': { auth: 'private' },
  '/post/getPostMetaBatch': { auth: 'optional' },
  '/post/getCommentsForPost': { auth: 'public' },
  '/post/addCommentToPost': { auth: 'private' },
  '/getLikedPostsForUser': { auth: 'public' },
  '/event/getEventTopics': { auth: 'public' },
  '/event/searchEvents': { auth: 'optional' },
  '/event/createEvent': { auth: 'private' },
  '/event/getEvent': { auth: 'optional' },
  '/event/updateEvent': { auth: 'private' },
  '/event/deleteEvent': { auth: 'private' },
  '/event/registerForEvent': { auth: 'private' },
  '/event/unregisterFromEvent': { auth: 'private' },
  '/event/hasUserRegisteredToEvent': { auth: 'private' },
  '/event/listMyEvents': { auth: 'private' },
  '/event/listRegisteredEvents': { auth: 'private' },
  '/event/listUserEvents': { auth: 'optional' },
  '/user/deleteComment': { auth: 'private' },
  '/post/editCommentOnPost': { auth: 'private' },
  '/post/deleteCommentFromPost': { auth: 'private' },
  '/user/saveOpenAlexProfile': { auth: 'private' },
  '/user/saveManualProfile': { auth: 'private' },
  '/project/getLocations': { auth: 'public' },
  '/getLikedContentForUser': { auth: 'public' },
  '/project/getProjectsPageData': { auth: 'optional' },
  '/verify/getInstituteVerificationDomain': { auth: 'private' },
  '/verify/requestMagicCode': { auth: 'private' },
  '/verify/submitMagicCode': {auth: 'private' },
  '/user/validateSignOn' : {auth: 'private' },
  '/user/updateLanguages': { auth: 'private' },
  '/user/getLanguages': { auth: 'public' },
  '/user/getTitles': { auth: 'public' },
  '/user/getFields': { auth: 'public' },
  '/user/getPositionTitles': { auth: 'public' },
  '/user/getPositionFields': { auth: 'public' },
  '/user/getAllRequiredInformationForUserPage': { auth: 'private' },
  '/user/getTopTopicScores': { auth: 'private' },
  '/project/getRecommendedProjects': { auth: 'private' },
  '/user/createReport': { auth: 'private' },
  '/user/deleteUser': { auth: 'private' },
  '/paper/getWorkTypes': { auth: 'optional' },
  '/paper/getSubtopics': { auth: 'optional' },
  '/paper/getTopics': { auth: 'optional' },
  '/paper/getTopicSiblings': { auth: 'optional' },

};

const route = async (rawPath, method, user, body) => {
    try {
        // /health
        if (rawPath === '/health') {
            return [200, { status: "ok" }];
        }

        // /user/setName
        if (rawPath === '/user/setName' && method === 'POST') {
            
            await userService.setName(user.sub, body.name);
            return [200, { message: "Success" }];
        }

        if(rawPath === '/user/getProfile') {
            if (body.userId){
                const resp = await userService.getProfile(body.userId);
                return [200, resp];
            } else if (user.sub) {
                const resp = await userService.getProfile(user.sub);
                return [200, resp];
            } else {
                return [400, {error: "No userId provided and no valid session"}];
            }
        }

        if (rawPath === '/user/deleteUser' && method === 'POST') {
            const resp = await userService.deleteUser(user.sub);
            return [200, resp];
        }

        if (rawPath === '/user/updateBio' && method === 'POST') {
            const resp = await userService.updateBio(user.sub, body.bio);
            return [200, resp];
        }

        if (rawPath === '/user/updateSkills' && method === 'POST') {
            const resp = await userService.updateSkills(user.sub, body.skills);
            return [200, resp];
        }

        if (rawPath === '/user/updateResearchInterests' && method === 'POST') {
            const resp = await userService.updateResearchInterests(user.sub, body.interests);
            return [200, resp];
        }

        if (rawPath === '/user/updateProfile' && method === 'POST') {
            const resp = await userService.updateProfile(user.sub, body.patch);
            return [200, resp];
        }

        if (rawPath === '/project/searchProjects' && method === 'POST') {
            const resp = await projectService.searchProjects(user?.sub, body.filter);
            return [200, resp];
        }

        if (rawPath === '/project/createProject' && method === 'POST') {
            const resp = await projectService.createProject(user.sub, body.project);
            return [200, resp];
        }

        if (rawPath === '/project/deleteProject' && method === 'POST') {
            const resp = await projectService.deleteProject(user.sub, body.projectId);
            return [200, resp];
        }

        if (rawPath === '/project/getProject' && method === 'POST') {
            const resp = await projectService.getProject(user?.sub, body.projectId);
            return [200, resp];
        }

        if (rawPath === '/getLikedProjectsForUser' && method === 'POST') {
            const resp = await userService.getLikedProjectsForUser(body.userId);
            return [200, resp];
        }

        if (rawPath === '/project/getLikeCountForProject' && method === 'POST') {
            const resp = await projectService.getLikeCountForProject(body.projectId);
            return [200, resp];
        }

        if (rawPath === '/user/hasAppliedToProject' && method === 'POST') {
            const resp = await userService.hasAppliedToProject(user.sub, body.projectId);
            return [200, resp];
        }

        if (rawPath === '/user/hasLikedProject' && method === 'POST') {
            const resp = await userService.hasLikedProject(user.sub, body.projectId);
            return [200, resp];
        }

        if (rawPath === '/user/hasLikedPerson' && method === 'POST') {
            const resp = await userService.hasLikedPerson(user.sub, body.liked_user_sub);
            return [200, resp];
        }

        if (rawPath === '/file/getUploadURL' && method === 'POST') {
            // Logic for Size Control (explained in section 3)
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            if (body.fileSize > MAX_SIZE) {
                return [400, { error: "File too large" }];
            }

            const resp = await documentGetPresignedPutURL(body.fileName, body.fileType, body.fileSize, body.application_document_id, user.sub);

            if(resp) {
                return [200, resp];
            } else {
                return [500, { error: "Failed to generate upload URL" }];
            }
        }

        if (rawPath === '/file/getDownloadURL' && method === 'POST') {
            const resp = await documentGetPresignedGetURL(body.application_document_id, user.sub);
            if(resp) {
                return [200, resp];
            } else {
                return [500, { error: "Failed to generate download URL" }];
            }
        }

        if (rawPath === '/project/applyToProject' && method === 'POST') {
            const resp = await projectService.applyToProject(user.sub, body.projectId, body.documents);
            return [200, resp];
        }

        if (rawPath === '/project/getApplicants' && method === 'POST') {
            const resp = await projectService.getApplications(user.sub, body.projectId);
            return [200, resp];
        }

        if (rawPath === '/project/updateApplicationStatus' && method === 'POST') {
            const resp = await projectService.updateApplicationStatus(user.sub, body.applicationId, body.status);
            return [200, resp];
        }

        if (rawPath === '/project/listUserProjects' && method === 'POST') {
            const resp = await projectService.listUserProjects(user?.sub, body.userId);
            return [200, resp];
        }

        if (rawPath === '/getLikedPeopleForUser' && method === 'POST') {
            const resp = await userService.getLikedPeopleForUser(body.userId);
            console.log("resp is", resp);
            return [200, resp];
        }

        if (rawPath === '/notification/markRead' && method === 'POST') {
            const resp = await notificationService.markAsRead(user.sub, body.notificationId);
            return [200, resp];
        }

        if (rawPath === '/getCommentsForPaper' && method === 'POST') {
            const resp = await generalService.getCommentsForPaper(body.paper_id);
            return [200, resp];
        }

        if (rawPath === '/user/addCommentToPaper' && method === 'POST') {
            const resp = await userService.addCommentToPaper(user.sub, body.paper_id, body.text, body.reply_to_id);
            return [200, resp];
        }

        if (rawPath === '/user/editComment' && method === 'POST') {
            const resp = await userService.editComment(user.sub, body.comment_id, body.text);
            return [200, resp];
        }

        if (rawPath === '/getPaperMetaBatch' && method === 'POST') {
            const resp = await generalService.getPaperMetaBatch(user?.sub, body.paper_ids);
            return [200, resp];
        }

        if (rawPath === '/user/hasLikedPaper' && method === 'POST') {
            const resp = await userService.hasLikedPaper(user.sub, body.paperId);
            return [200, resp];
        }
        
        if (rawPath === '/user/toggleLikePaper' && method === 'POST') {
            const resp = await userService.toggleLikePaper(
                user.sub,
                body.paperId,
                body.topics || []
            );
            return [200, resp];
        }

        if (rawPath === '/getLikedPapersForUser' && method === 'POST') {
            const resp = await userService.getLikedPapersForUser(body.userId);
            return [200, resp];
        }

        if (rawPath === '/user/toggleLikeProject' && method === 'POST') {
            const resp = await userService.toggleLikeProject(user.sub, body.projectId);
            return [200, resp];
        }

        if (rawPath === '/user/getAvatarUploadURL' && method === 'POST') {
            // Logic for Size Control (explained in section 3)
            const MAX_SIZE = 2 * 1024 * 1024; // 5MB
            if (body.fileSize > MAX_SIZE) {
                return [400, { error: "File too large" }];
            }

            if (body.fileType !== "image/webp") {
                return [400, { error: "Invalid file type" }];
            }

            const resp = await avatarGetPresignedPutURL(body.fileType, body.fileSize, user.sub);

            if(resp) {
                return [200, resp];
            } else {
                return [500, { error: "Failed to generate upload URL" }];
            }
        }

        if (rawPath === '/user/toggleLikePerson' && method === 'POST') {
            const resp = await userService.toggleLikePerson(user.sub, body.liked_user_sub);
            return [200, resp];
        }

        if (rawPath === '/project/getProjectTypes' && method === 'POST') {
            const resp = await projectService.getProjectTypes();
            return [200, resp];
        }

        if (rawPath === '/project/updateProject' && method === 'POST') {
            const resp = await projectService.updateProject(user.sub, body.projectId, body.project);
            return [200, resp];
        }

        if (rawPath === '/project/getTopics' && method === 'POST') {
            const resp = await projectService.getTopics();
            return [200, resp];
        }

        if (rawPath === '/project/getSkills' && method === 'POST') {
            const resp = await projectService.getSkills();
            return [200, resp];
        }

        if (rawPath === '/user/saveOpenAlexProfile' && method === 'POST') {
            console.log("Saving openAlex profile")
            const resp = await userService.saveOpenAlexProfile(
                user.sub,
                body.openAlexId,
                body.openAlexProfile,
                body.papers,       
                body.topicStats,   
                body.coauthors     
            );
            return [200, resp];
        }

        if (rawPath === '/user/getPeople' && method === 'POST') {
            console.log("inside index");
            const resp = await userService.getPeople(user.sub, body.filters);
            return [200, resp];
        }

        if (rawPath === '/user/getConnections' && method === 'POST') {
            const resp = await userService.getConnections(user.sub);
            return [200, resp];
        }

        if (rawPath === '/user/searchMyProjectApplications' && method === 'POST') {
            const resp = await userService.searchMyProjectApplications(user.sub, body.filters);
            return [200, resp];
        }

        if (rawPath === '/project/getInstitutes' && method === 'POST') {
            const resp = await projectService.getInstitutes(body.query || '');
            return [200, resp];
        }

        if (rawPath === '/post/getPostTopics' && method === 'POST') {
            const resp = await postService.getPostTopics();
            return [200, resp];
        }

        if (rawPath === '/post/searchPosts' && method === 'POST') {
            const resp = await postService.searchPosts(user?.sub, body.filter || {});
            return [200, resp];
        }

        if (rawPath === '/post/listUserPosts' && method === 'POST') {
            const resp = await postService.listUserPosts(body.userId);
            return [200, resp];
        }

        if (rawPath === '/post/getFeedPosts' && method === 'POST') {
            const resp = await postService.getFeedPosts(user.sub, body.filter || {});
            return [200, resp];
        }

        if (rawPath === '/post/createPost' && method === 'POST') {
            const resp = await postService.createPost(user.sub, body.post);
            return [200, resp];
        }

        if (rawPath === '/post/getPost' && method === 'POST') {
            const resp = await postService.getPost(user?.sub, body.postId);
            return [200, resp];
        }

        if (rawPath === '/post/updatePost' && method === 'POST') {
            const resp = await postService.updatePost(user.sub, body.postId, body.post);
            return [200, resp];
        }

        if (rawPath === '/post/deletePost' && method === 'POST') {
            const resp = await postService.deletePost(user.sub, body.postId);
            return [200, resp];
        }

        if (rawPath === '/post/toggleLikePost' && method === 'POST') {
            const resp = await postService.toggleLikePost(user.sub, body.postId);
            return [200, resp];
        }
        
        if (rawPath === '/post/getPostMetaBatch' && method === 'POST') {
            const resp = await postService.getPostMetaBatch(user?.sub, body.postIds || []);
            return [200, resp];
        }
        
        if (rawPath === '/post/getCommentsForPost' && method === 'POST') {
            const resp = await postService.getCommentsForPost(body.postId);
            return [200, resp];
        }
        
        if (rawPath === '/post/addCommentToPost' && method === 'POST') {
            const resp = await postService.addCommentToPost(
                user.sub,
                body.postId,
                body.text,
                body.replyToId
            );
            return [200, resp];
        }

        if (rawPath === '/getLikedPostsForUser' && method === 'POST') {
            const resp = await postService.getLikedPostsForUser(body.userId);
            return [200, resp];
        }

        if (rawPath === '/event/getEventTopics' && method === 'POST') {
            const resp = await eventService.getEventTopics();
            return [200, resp];
        }

        if (rawPath === '/event/searchEvents' && method === 'POST') {
            console.log("should go in here");
            console.log(body.filter);
            const resp = await eventService.searchEvents(user?.sub, body.filter || {});
            return [200, resp];
        }

        if (rawPath === '/event/createEvent' && method === 'POST') {
            const resp = await eventService.createEvent(user.sub, body.event);
            return [200, resp];
        }

        if (rawPath === '/event/getEvent' && method === 'POST') {
            const resp = await eventService.getEvent(user?.sub, body.eventId);
            return [200, resp];
        }

        if (rawPath === '/event/updateEvent' && method === 'POST') {
            const resp = await eventService.updateEvent(user.sub, body.eventId, body.event);
            return [200, resp];
        }

        if (rawPath === '/event/deleteEvent' && method === 'POST') {
            const resp = await eventService.deleteEvent(user.sub, body.eventId);
            return [200, resp];
        }

        if (rawPath === '/event/registerForEvent' && method === 'POST') {
            const resp = await eventService.registerForEvent(user.sub, body.eventId);
            return [200, resp];
        }

        if (rawPath === '/event/unregisterFromEvent' && method === 'POST') {
            const resp = await eventService.unregisterFromEvent(user.sub, body.eventId);
            return [200, resp];
        }

        if (rawPath === '/event/hasUserRegisteredToEvent' && method === 'POST') {
            const resp = await eventService.hasUserRegisteredToEvent(user.sub, body.eventId);
            return [200, resp];
        }

        if (rawPath === '/event/listMyEvents' && method === 'POST') {
            const resp = await eventService.listMyEvents(user.sub);
            return [200, resp];
        }

        if (rawPath === '/event/listRegisteredEvents' && method === 'POST') {
            const resp = await eventService.listRegisteredEvents(user.sub);
            return [200, resp];
        }
        
        if (rawPath === '/user/getRecommendations' && method === 'POST') {
            const targetSub = body.targetSub || user.sub;
            const resp = await userService.getRecommendations(targetSub);
            return [200, resp];
        }

        if (rawPath === '/event/listUserEvents' && method === 'POST') {
            const resp = await eventService.listUserEvents(user?.sub, body.userId);
            return [200, resp];
        }

        if (rawPath === '/user/deleteComment' && method === 'POST') {
            const resp = await userService.deleteComment(user.sub, body.comment_id);
            return [200, resp];
        }

        if (rawPath === '/post/editCommentOnPost' && method === 'POST') {
            const resp = await postService.editCommentOnPost(user.sub, body.commentId, body.text);
            return [200, resp];
        }
        
        if (rawPath === '/post/deleteCommentFromPost' && method === 'POST') {
            const resp = await postService.deleteCommentFromPost(user.sub, body.commentId);
            return [200, resp];
        }
        
        if (rawPath === '/user/saveManualProfile' && method === 'POST') {
            const resp = await userService.saveManualProfile(user.sub, body.manualForm);
            return [200, resp];
        }

        if (rawPath === '/project/getLocations' && method === 'POST') {
            const resp = await projectService.getLocations(body.query || '');
            return [200, resp];
        }

        if (rawPath === '/getLikedContentForUser' && method === 'POST') {
            const resp = await userService.getLikedContentForUser(body.userId);
            return [200, resp];
        }

        if (rawPath === '/project/getProjectsPageData' && method === 'POST') {
            const resp = await projectService.getProjectsPageData(user?.sub, body.filter || {});
            return [200, resp];
        }

        if (rawPath === '/verify/getInstituteVerificationDomain' && method === 'POST') {
            const resp = await getInstituteVerificationDomain(user.sub);
            return [200, resp];
        }

        if (rawPath === '/verify/requestMagicCode' && method === 'POST') {
            const resp = await sendMagicCode(user.sub, body.name, body.chosenDomain);
            return [200, resp];
        }

        if (rawPath === '/verify/submitMagicCode' && method === 'POST') {
            const resp = await verifyMagicCode(user.sub, body.magicCode);
            return [200, resp];
        }

        if (rawPath === '/user/validateSignOn' && method === 'POST') {
            const resp = await userService.validateSignOn(user.sub);
            return [200, resp];
        }

        if (rawPath === '/user/updateLanguages' && method === 'POST') {
            const resp = await userService.updateLanguages(user.sub, body.languages);
            return [200, resp];
        }
        
        if (rawPath === '/user/getLanguages' && method === 'POST') {
            const resp = await userService.getLanguages();
            return [200, resp];
        }

        if (rawPath === '/user/getTitles' && method === 'POST') {
            const resp = await userService.getTitles();
            return [200, resp];
        }

        if (rawPath === '/user/getFields' && method === 'POST') {
            const resp = await userService.getFields();
            return [200, resp];
        }

        if (rawPath === '/user/getPositionTitles' && method === 'POST') {
            const resp = await userService.getPositionTitles();
            return [200, resp];
        }
        
        if (rawPath === '/user/getPositionFields' && method === 'POST') {
            const resp = await userService.getPositionFields();
            return [200, resp];
        }        

        if (rawPath === '/user/getAllRequiredInformationForUserPage' && method === 'POST') {
            const targetUserId = body.userId || user.sub;

            if (!targetUserId) {
                return [400, { error: "No userId provided and no valid session" }];
            }

            const resp = await userService.getAllRequiredInformationForUserPage(
                user.sub,
                targetUserId
            );

            if (!resp) {
                return [404, { error: "User not found" }];
            }

            return [200, resp];
        }

        if (rawPath === '/user/getTopTopicScores' && method === 'POST') {
            const resp = await userService.getTopTopicScores(user.sub, body.limit || 10);
            return [200, resp];
        }

        if (rawPath === '/project/getRecommendedProjects' && method === 'POST') {
            const resp = await projectService.getRecommendedProjects(user.sub, body.page || 1, body.results_per_page || 10);
            return [200, resp];
        }

        if (rawPath === '/paper/getWorkTypes' && method === 'POST') {
            const resp = await generalService.getWorkTypes();
            return [200, resp];
        }
        
        if (rawPath === '/paper/getSubtopics' && method === 'POST') {
            const resp = await generalService.getSubtopics(body.query || '', body.topicId || null);
            return [200, resp];
        }
        
        if (rawPath === '/paper/getTopics' && method === 'POST') {
            const resp = await generalService.getTopics(body.subtopicId || null, body.query || '');
            return [200, resp];
        }
        
        if (rawPath === '/paper/getTopicSiblings' && method === 'POST') {
            const resp = await generalService.getTopicSiblings(body.topicId);
            return [200, resp];
        }

        if (rawPath === '/user/createReport' && method === 'POST') {
            const resp = await userService.createReport(
                user.sub,
                body.reportedItemType,
                body.reportedItemId,
                body.reportNote
            );
            return [200, resp];
        }
        
        return [404, { error: "Not Found" }];
    } catch (err) {
        console.error(err);
        return [500, { error: err.message }];
    }
}

export const handler = async (event) => {

    let user = null;

    const { rawPath, requestContext } = event;
    const method = requestContext.http.method; //GET/POST
    const routeConfig = ROUTES[rawPath];
    console.log(rawPath);

    if (method === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                "Access-Control-Allow-Origin": "peer-grid.de", // Or your frontend domain
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
                "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                "Access-Control-Max-Age": "86400" // Cache preflight for 24h
            }
        };
    }
    
    // Check if route exists
    if (!routeConfig) return response(404, { error: "Not Found" });

    // Authentication handling
    if (routeConfig.auth === 'private' || routeConfig.auth === 'optional') {
        // Try to authorize token if it exists
        const token = event.headers.authorization?.replace("Bearer ", "");
        if (token) {
            try {
                //console.log(token);
                user = await verifier.verify(token);
            } catch (err) {
                console.error(err);
                return { statusCode: 401, body: JSON.stringify({ message: "Invalid Token" }) };
            }
        } else if (routeConfig.auth === 'private') {
            // If Route is private, enforce auth
            return response(401, { error: "Login required" });
        }        
    }

    // Routing
    const body = JSON.parse(event.body || '{}');
    const [status, resp] = await route(rawPath, method, user, body);

    var ret = {};
    // Piggybacking new notifications
    if (user?.sub) {
        try {
            const nots = await notificationService.getUnreadNotifications(user.sub);
            ret.notification_piggyback = { status: "ok", new_notifications: nots }; 
        } catch (err) {
            console.log("ERROR getting notifications")
            console.log(err);
            ret.notification_piggyback = { status: "error", new_notifications: [] }; 
        }
    }

    ret.result = resp;

    return response(status, ret);
    
};

const response = (status, data) => ({
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
});