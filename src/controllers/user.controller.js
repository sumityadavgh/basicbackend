import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from '../utils/ApiError.js'
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessTokenAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Failed to generate token")
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // steps to crete register controller
    // get user details from frontend
    // vadilation - no empty data
    // check if user already exist
    // check for images and avatar
    // upload them to cloudinary
    // create user --- to create entry in database
    // remove password and refresh token
    // check for user creation
    // return response

    const {fullName, email, username, password} = req.body

    if(
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or:[{username}, {email}]
    })

    if(existedUser) {
        throw new ApiError(409, "user or password already used")
    }

    const avatarLocalPath = await req.files?.avatar[0]?.path;
    // const coverImageLocalPath = await req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar Required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar Required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successflly")
    )
})

const loginUser = asyncHandler( async(req,res) => {
    // steps to create login controller 
    // take email and user from user
    // find user
    // password check
    // match  tokren
    // send cookie

    const {username, email, password} = req.body;

    if(!username || !email) {
        throw new ApiError(400, "Enter username or password")
    }
    const user = await User.findOne({
        $or: [{username}, {email}]
    });

    if(!user) {
        throw new Error(404, "User does not exist")
    }

    const isPasswordValid = user.isPasswordCorrect(password);
    if(!isPasswordValid) {
        throw new ApiError(401, "Enter Valid Password");
    }

    const {refreshToken, accessToken} = await generateAccessTokenAndRefreshToken(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

} )

const logoutUser = asyncHandler( async(req, res) => {
    // get the id from req.user?.id by making query from User
    // erase refresh Token by using $set operator
    // return response
    // clear cookie
    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json( new ApiResponse(200, {}, "User logged Out"))

})

export { registerUser, loginUser, logoutUser}