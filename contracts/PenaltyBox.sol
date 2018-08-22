pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract PenaltyBox is Ownable {

    // Make sure we can be safe with uints
    using SafeMath for uint;

    // Custom structure for data needed against each account
    struct accountData {
        uint balance;
        uint releaseTime;
    }

    // 10% possible withdrawal fee
    uint constant public fee = 10;
    uint constant public denominator = 100;

    // Each account is assigned by address
    mapping(address => accountData) public accounts;

    // Triggered on deposit
    event Deposit(address depositor, uint amount, uint balance, uint releaseTime);

    // Triggered on withdrawal
    event Withdrawal(address depositor, uint amount);

    // Time to lock the funds until
    function deposit(uint releaseTime) external payable {

        // Lock time must be in the future
        require(releaseTime > getNow());

        // Deposit amount must be enough to possibly trigger a withdrawal fee (10 Wei)
        require(msg.value >= 10);

        // Deposit amount
        uint depositAmount = msg.value;

        // Set sender's balance to be the deposit amount plus any amount that is already there (default 0)
        accounts[msg.sender].balance = depositAmount + accounts[msg.sender].balance;

        // If the release time is larger than the one set, or there isn't one set, change the release time
        if (releaseTime > accounts[msg.sender].releaseTime) {
            accounts[msg.sender].releaseTime = releaseTime;
        }

        // Record the event
        emit Deposit(msg.sender, depositAmount, accounts[msg.sender].balance, accounts[msg.sender].releaseTime);
    }

    // Allow users to withdraw funds
    function withdraw(bool allowEarly) external {

        // if they have funds and it's post-release then send the funds, else stop
        require(accounts[msg.sender].balance != 0 && (allowEarly || accounts[msg.sender].releaseTime <= getNow()));

        // Default withdrawal amount if no penalty
        uint withdrawalAmount = accounts[msg.sender].balance;

        // if it's early the user is charged 10%
        if (accounts[msg.sender].releaseTime > getNow()) {
            // Fee amount
            uint feePayable = accounts[msg.sender].balance.mul(fee).div(denominator);

            // Deposit amount
            withdrawalAmount = accounts[msg.sender].balance.sub(feePayable);

            // Send fee
            owner.transfer(feePayable);
        }

        // Reset withdrawer information
        accounts[msg.sender].balance = 0;
        accounts[msg.sender].releaseTime = 0;

        // Send ether to withdrawer
        msg.sender.transfer(withdrawalAmount);

        // Record the event
        emit Withdrawal(msg.sender, withdrawalAmount);
    }

    function getNow() internal view returns (uint) {
        return now;
    }
}
