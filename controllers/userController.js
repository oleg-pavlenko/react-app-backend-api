const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');

// how long a token lasts before expiring
const tokenLasts = '30d';

exports.apiGetPostsByUsername = async function apiGetPostsByUsername(req, res) {
  try {
    const authorDoc = await User.findByUsername(req.params.username);
    const posts = await Post.findByAuthorId(authorDoc._id);
    // res.header("Cache-Control", "max-age=10").json(posts)
    res.json(posts);
  } catch (e) {
    res.status(500).send('Sorry, invalid user requested.');
  }
};

exports.checkToken = function checkToken(req, res) {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    res.json(true);
  } catch (e) {
    res.json(false);
  }
};

exports.apiMustBeLoggedIn = function apiMustBeLoggedIn(req, res, next) {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    next();
  } catch (e) {
    res.status(500).send('Sorry, you must provide a valid token.');
  }
};

exports.doesUsernameExist = function doesUsernameExist(req, res) {
  User.findByUsername(req.body.username.toLowerCase())
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

exports.doesEmailExist = async function doesEmailExist(req, res) {
  const emailBool = await User.doesEmailExist(req.body.email);
  res.json(emailBool);
};

exports.sharedProfileData = async function sharedProfileData(req, res, next) {
  let viewerId;
  try {
    const viewer = jwt.verify(req.body.token, process.env.JWTSECRET);
    viewerId = viewer._id;
  } catch (e) {
    viewerId = 0;
  }
  req.isFollowing = await Follow.isVisitorFollowing(req.profileUser._id, viewerId);

  const postCountPromise = Post.countPostsByAuthor(req.profileUser._id);
  const followerCountPromise = Follow.countFollowersById(req.profileUser._id);
  const followingCountPromise = Follow.countFollowingById(req.profileUser._id);
  const [postCount, followerCount, followingCount] = await Promise.all(
    [postCountPromise, followerCountPromise, followingCountPromise],
  );

  req.postCount = postCount;
  req.followerCount = followerCount;
  req.followingCount = followingCount;

  next();
};

exports.apiLogin = function apiLogin(req, res) {
  const user = new User(req.body);
  user
    .login()
    .then(() => {
      res.json({
        token: jwt.sign({
          _id: user.data._id,
          username: user.data.username,
          avatar: user.avatar,
        },
        process.env.JWTSECRET,
        { expiresIn: tokenLasts }),
        username: user.data.username,
        avatar: user.avatar,
      });
    })
    .catch(() => {
      res.json(false);
    });
};

exports.apiRegister = function apiRegister(req, res) {
  const user = new User(req.body);
  user
    .register()
    .then(() => {
      res.json({
        token: jwt.sign({
          _id: user.data._id,
          username: user.data.username,
          avatar: user.avatar,
        },
        process.env.JWTSECRET,
        { expiresIn: tokenLasts }),
        username: user.data.username,
        avatar: user.avatar,
      });
    })
    .catch((regErrors) => {
      res.status(500).send(regErrors);
    });
};

exports.apiGetHomeFeed = async function apiGetHomeFeed(req, res) {
  try {
    const posts = await Post.getFeed(req.apiUser._id);
    res.json(posts);
  } catch (e) {
    res.status(500).send('Error');
  }
};

exports.ifUserExists = function ifUserExists(req, res, next) {
  User.findByUsername(req.params.username)
    .then((userDocument) => {
      req.profileUser = userDocument;
      next();
    })
    .catch(() => {
      res.json(false);
    });
};

exports.profileBasicData = function profileBasicData(req, res) {
  res.json({
    profileUsername: req.profileUser.username,
    profileAvatar: req.profileUser.avatar,
    isFollowing: req.isFollowing,
    counts: {
      postCount: req.postCount,
      followerCount: req.followerCount,
      followingCount: req.followingCount,
    },
  });
};

exports.profileFollowers = async function profileFollowers(req, res) {
  try {
    const followers = await Follow.getFollowersById(req.profileUser._id);
    // res.header("Cache-Control", "max-age=10").json(followers)
    res.json(followers);
  } catch (e) {
    res.status(500).send('Error');
  }
};

exports.profileFollowing = async function profileFollowing(req, res) {
  try {
    const following = await Follow.getFollowingById(req.profileUser._id);
    // res.header("Cache-Control", "max-age=10").json(following)
    res.json(following);
  } catch (e) {
    res.status(500).send('Error');
  }
};
