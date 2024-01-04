import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

// get the token either from header or cookies
// decode the token using jwt.verify
// remove password and refresh Token from decoded token and store it in user

export const verifyJWT = asyncHandler( async(req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        if(!token) {
            throw new ApiError(401, "Unauthorized Request")
        }

        const decodeToken  = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user = User.findById(decodeToken?._id).select("--password --refreshToken")
        if(!user) {
            throw new ApiError(401, "Invalid Access Token");
        }
        
        req.user = user;
        next();

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})