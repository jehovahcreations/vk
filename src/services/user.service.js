const userRepository = require("../repositories/user.repository");

async function getUserById(id) {
  return userRepository.findById(id);
}

async function getUserByAffiliateCode(code) {
  return userRepository.findByAffiliateCode(code);
}

module.exports = {
  getUserById,
  getUserByAffiliateCode
};
