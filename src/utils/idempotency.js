function isAlreadyProcessed(record) {
  return Boolean(record && record.processed);
}

module.exports = {
  isAlreadyProcessed
};
