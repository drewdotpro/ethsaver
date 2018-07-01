const TimeLocked = artifacts.require("TimeLocked");
const InterestByFee = artifacts.require("InterestByFee");

module.exports = function(deployer) {
    deployer.deploy(TimeLocked);
    deployer.deploy(InterestByFee);
};
