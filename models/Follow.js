const { ObjectID } = require('mongodb');
const usersCollection = require('../db').db().collection('users');
const followsCollection = require('../db').db().collection('follows');
const User = require('./User');

const Follow = function Follow(followedUsername, authorId) {
  this.followedUsername = followedUsername;
  this.authorId = authorId;
  this.errors = [];
};

Follow.prototype.cleanUp = async function cleanUp() {
  if (typeof (this.followedUsername) !== 'string') { this.followedUsername = ''; }
};

Follow.prototype.validate = async function validate(action) {
  // followedUsername must exist in database
  const followedAccount = await usersCollection.findOne({ username: this.followedUsername });
  if (followedAccount) {
    this.followedId = followedAccount._id;
  } else {
    this.errors.push('You cannot follow a user that does not exist.');
  }

  const doesFollowAlreadyExist = await followsCollection.findOne(
    {
      followedId: this.followedId,
      authorId: new ObjectID(this.authorId),
    },
  );
  if (action === 'create') {
    if (doesFollowAlreadyExist) { this.errors.push('You are already following this user.'); }
  }
  if (action === 'delete') {
    if (!doesFollowAlreadyExist) { this.errors.push('You cannot stop following someone you do not already follow.'); }
  }

  // should not be able to follow yourself
  if (this.followedId.equals(this.authorId)) { this.errors.push('You cannot follow yourself.'); }
};

Follow.prototype.create = function create() {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    await this.validate('create');
    if (!this.errors.length) {
      await followsCollection.insertOne({
        followedId: this.followedId,
        authorId: new ObjectID(this.authorId),
      });
      resolve();
    } else {
      reject(this.errors);
    }
  });
};

Follow.prototype.delete = function deleteFunc() {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    await this.validate('delete');
    if (!this.errors.length) {
      await followsCollection.deleteOne({
        followedId: this.followedId,
        authorId: new ObjectID(this.authorId),
      });
      resolve();
    } else {
      reject(this.errors);
    }
  });
};

Follow.isVisitorFollowing = async function isVisitorFollowing(followedId, visitorId) {
  const followDoc = await followsCollection.findOne({
    followedId,
    authorId: new ObjectID(visitorId),
  });
  if (followDoc) {
    return true;
  }
  return false;
};

Follow.getFollowersById = function getFollowersById(id) {
  return new Promise(async (resolve, reject) => {
    try {
      let followers = await followsCollection.aggregate([
        { $match: { followedId: id } },
        {
          $lookup: {
            from: 'users', localField: 'authorId', foreignField: '_id', as: 'userDoc',
          },
        },
        {
          $project: {
            username: { $arrayElemAt: ['$userDoc.username', 0] },
            email: { $arrayElemAt: ['$userDoc.email', 0] },
          },
        },
      ]).toArray();
      followers = followers.map((follower) => {
        const user = new User(follower, true);
        return { username: follower.username, avatar: user.avatar };
      });
      resolve(followers);
    } catch (e) {
      reject();
    }
  });
};

Follow.getFollowingById = function getFollowingById(id) {
  return new Promise(async (resolve, reject) => {
    try {
      let followers = await followsCollection.aggregate([
        { $match: { authorId: id } },
        {
          $lookup: {
            from: 'users', localField: 'followedId', foreignField: '_id', as: 'userDoc',
          },
        },
        {
          $project: {
            username: { $arrayElemAt: ['$userDoc.username', 0] },
            email: { $arrayElemAt: ['$userDoc.email', 0] },
          },
        },
      ]).toArray();
      followers = followers.map((follower) => {
        const user = new User(follower, true);
        return { username: follower.username, avatar: user.avatar };
      });
      resolve(followers);
    } catch (e) {
      reject();
    }
  });
};

Follow.countFollowersById = function countFollowersById(id) {
  return new Promise(async (resolve, reject) => {
    const followerCount = await followsCollection.countDocuments({ followedId: id });
    resolve(followerCount);
  });
};

Follow.countFollowingById = function countFollowingById(id) {
  return new Promise(async (resolve, reject) => {
    const count = await followsCollection.countDocuments({ authorId: id });
    resolve(count);
  });
};

module.exports = Follow;
