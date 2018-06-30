pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract TimeLocked is Ownable {

    // Make sure we can be safe with uints
    using SafeMath for uint;

    // Custom structure for data needed against each account
    struct accountData {
        uint balance;
        uint releaseTime;
    }

    event Deposit(address depositor, uint amount, uint balance, uint releaseTime);
    event Withdrawal(address depositor, uint amount);

    // 0.5% deposit fee
    uint constant public fee = 5;
    uint constant public denominator = 1000;

    // Each account is assigned by address
    mapping (address => accountData) public accounts;

    // Time to lock the funds until
    function deposit(uint releaseTime) external payable {

        // Lock time must be in the future
        require(releaseTime > getNow());

        // Deposit amount must be enough to trigger a fee (200 Wei)
        require(msg.value >= 200);

        // Fee amount
        uint feePayable = msg.value.mul(fee).div(denominator);

        // Deposit amount
        uint depositAmount = msg.value.sub(feePayable);

        // Send fee
        owner.transfer(feePayable);

        // Set sender's balance to be the deposit amount plus any amount that is already there (default 0)
        accounts[msg.sender].balance = depositAmount + accounts[msg.sender].balance;

        // If the release time is larger than the one set, or there isn't one set, change the release time
        if (releaseTime > accounts[msg.sender].releaseTime) {
            accounts[msg.sender].releaseTime = releaseTime;
        }

        // Record the event
        emit Deposit(msg.sender, depositAmount, accounts[msg.sender].balance, accounts[msg.sender].releaseTime);
    }

    function withdraw() external {

        // if they have funds and it's post-release then send the funds, else stop
        require(accounts[msg.sender].balance != 0 && accounts[msg.sender].releaseTime < getNow());

        // Set how much we're withdrawing
        uint withdrawalAmount = accounts[msg.sender].balance;

        // Reset withdrawer information
        accounts[msg.sender].balance = 0;
        accounts[msg.sender].releaseTime = 0;

        // Send ether to withdrawer
        msg.sender.transfer(withdrawalAmount);

        // Record the event
        emit Withdrawal(msg.sender, withdrawalAmount);
    }

    // Unit tests need to control the time so this simply returns now in a real contract and a mock time in a test
    function getNow() private view returns(uint) {
        return now;
    }

}
