const TimeLocked = artifacts.require("TimeLocked");
const PenaltyBox = artifacts.require("PenaltyBox");

module.exports = function(deployer) {
    deployer.deploy(TimeLocked);
    deployer.deploy(PenaltyBox);
};
