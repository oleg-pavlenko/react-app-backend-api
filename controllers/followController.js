const Follow = require('../models/Follow');

exports.apiAddFollow = function apiAddFollow(req, res) {
  const follow = new Follow(req.params.username, req.apiUser._id);
  follow
    .create()
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};

exports.apiRemoveFollow = function apiRemoveFollow(req, res) {
  const follow = new Follow(req.params.username, req.apiUser._id);
  follow
    .delete()
    .then(() => {
      res.json(true);
    })
    .catch(() => {
      res.json(false);
    });
};
