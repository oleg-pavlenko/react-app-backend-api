const { ObjectID } = require('mongodb');
const sanitizeHTML = require('sanitize-html');
const postsCollection = require('../db').db().collection('posts');
const followsCollection = require('../db').db().collection('follows');
const User = require('./User');

const Post = function Post(data, userid, requestedPostId) {
  this.data = data;
  this.errors = [];
  this.userid = userid;
  this.requestedPostId = requestedPostId;
};

Post.prototype.cleanUp = function cleanUp() {
  if (typeof (this.data.title) !== 'string') { this.data.title = ''; }
  if (typeof (this.data.body) !== 'string') { this.data.body = ''; }

  // get rid of any bogus properties
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), { allowedTags: [], allowedAttributes: {} }),
    body: sanitizeHTML(this.data.body.trim(), { allowedTags: [], allowedAttributes: {} }),
    createdDate: new Date(),
    author: ObjectID(this.userid),
  };
};

Post.prototype.validate = function validate() {
  if (this.data.title === '') { this.errors.push('You must provide a title.'); }
  if (this.data.body === '') { this.errors.push('You must provide post content.'); }
};

Post.prototype.create = function create() {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      // save post into database
      postsCollection.insertOne(this.data).then((info) => {
        resolve(info.ops[0]._id);
      }).catch(() => {
        this.errors.push('Please try again later.');
        reject(this.errors);
      });
    } else {
      reject(this.errors);
    }
  });
};

Post.prototype.update = function update() {
  return new Promise(async (resolve, reject) => {
    try {
      const post = await Post.findSingleById(this.requestedPostId, this.userid);
      if (post.isVisitorOwner) {
        // actually update the db
        const status = await this.actuallyUpdate();
        resolve(status);
      } else {
        reject();
      }
    } catch (e) {
      reject();
    }
  });
};

Post.prototype.actuallyUpdate = function actuallyUpdate() {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      await postsCollection.findOneAndUpdate(
        { _id: new ObjectID(this.requestedPostId) },
        { $set: { title: this.data.title, body: this.data.body } },
      );
      resolve('success');
    } else {
      resolve('failure');
    }
  });
};

Post.reusablePostQuery = function reusablePostQuery(uniqueOperations, visitorId) {
  return new Promise((async (resolve, reject) => {
    const aggOperations = uniqueOperations.concat([
      {
        $lookup: {
          from: 'users', localField: 'author', foreignField: '_id', as: 'authorDocument',
        },
      },
      {
        $project: {
          title: 1,
          body: 1,
          createdDate: 1,
          authorId: '$author',
          author: { $arrayElemAt: ['$authorDocument', 0] },
        },
      },
    ]);

    let posts = await postsCollection.aggregate(aggOperations).toArray();

    // clean up author property in each post object
    posts = posts.map((post) => {
      post.isVisitorOwner = post.authorId.equals(visitorId);
      post.authorId = undefined;

      post.author = {
        username: post.author.username,
        avatar: new User(post.author, true).avatar,
      };

      return post;
    });

    resolve(posts);
  }));
};

Post.findSingleById = function findSingleById(id, visitorId) {
  return new Promise((async (resolve, reject) => {
    if (typeof (id) !== 'string' || !ObjectID.isValid(id)) {
      reject();
      return;
    }

    const posts = await Post.reusablePostQuery([
      { $match: { _id: new ObjectID(id) } },
    ], visitorId);

    if (posts.length) {
      resolve(posts[0]);
    } else {
      reject();
    }
  }));
};

Post.findByAuthorId = function findByAuthorId(authorId) {
  return Post.reusablePostQuery([
    { $match: { author: authorId } },
    { $sort: { createdDate: -1 } },
  ]);
};

Post.delete = function deleteFunc(postIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      const post = await Post.findSingleById(postIdToDelete, currentUserId);
      if (post.isVisitorOwner) {
        await postsCollection.deleteOne({ _id: new ObjectID(postIdToDelete) });
        resolve();
      } else {
        reject();
      }
    } catch (e) {
      reject();
    }
  });
};

Post.search = function search(searchTerm) {
  return new Promise(async (resolve, reject) => {
    if (typeof (searchTerm) === 'string') {
      const posts = await Post.reusablePostQuery([
        { $match: { $text: { $search: searchTerm } } },
        { $sort: { score: { $meta: 'textScore' } } },
      ]);
      resolve(posts);
    } else {
      reject();
    }
  });
};

Post.countPostsByAuthor = function countPostsByAuthor(id) {
  return new Promise(async (resolve, reject) => {
    const postCount = await postsCollection.countDocuments({ author: id });
    resolve(postCount);
  });
};

Post.getFeed = async function getFeed(id) {
  // create an array of the user ids that the current user follows
  let followedUsers = await followsCollection.find({ authorId: new ObjectID(id) }).toArray();
  followedUsers = followedUsers.map((followDoc) => followDoc.followedId);

  // look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([
    { $match: { author: { $in: followedUsers } } },
    { $sort: { createdDate: -1 } },
  ]);
};

module.exports = Post;
