pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract InterestByFee {

    // Make sure we can be safe with uints
    using SafeMath for uint;

    // Percentage fee
    uint constant public fee = 10;

    // Amount collected from fees
    uint public collectedFees;

    // Amount deposited
    uint public totalUserBalances;

    // Custom structure for data needed against each account
    struct accountData {
        uint balance;
        uint feeOffset;
    }

    // Each account is assigned by address
    mapping(address => accountData) public accounts;

    // Triggered on deposit
    event Deposit(address depositor, uint amount);

    // Triggered on withdrawal
    event Withdrawal(address depositor, uint amount);

    // Time to lock the funds until
    function deposit() external payable {

        // Deposit amount must be greater than zero
        require(msg.value > 0);

        // User can't have an account already
        require(accounts[msg.sender].balance == 0);

        // Set sender's balance to be the deposit amount
        accounts[msg.sender].balance = msg.value;

        // Record the total funds
        totalUserBalances += msg.value;

        // If fees have already been collected by this contract, this new depositor should only get future ones
        accounts[msg.sender].feeOffset = collectedFees;

        // Record the event
        emit Deposit(msg.sender, msg.value);
    }

    // Allow the user to withdraw their funds, with a 10% fee
    function withdraw() external {

        // if they have funds, else stop
        require(accounts[msg.sender].balance != 0);

        // The amount we're going to pay out, to be set below in the if
        uint totalPayable;

        // The user's balance
        uint userBalance = accounts[msg.sender].balance;

        if(userBalance == totalUserBalances) {

            //Last user, so it's simple - they get everything
            totalPayable = address(this).balance;
            totalUserBalances = 0;
            collectedFees = 0;

        } else {

            // The fees collected since they started saving
            uint feesCollectedSinceDeposit = collectedFees - accounts[msg.sender].feeOffset;

            // Calculate the users share of fees
            uint shareOfFees = feesCollectedSinceDeposit
            .mul(userBalance)
            .div(totalUserBalances);

            // How much the user would get, before fees are taken
            uint preFeePayable = userBalance + shareOfFees;

            uint feePayable = preFeePayable
            .mul(fee)
            .div(100);

            // Total amount payable to the user
            totalPayable = preFeePayable - feePayable;

            // Reduce the total
            totalUserBalances -= userBalance;

            // Update the fees we've collected
            collectedFees = (collectedFees - shareOfFees) + feePayable;
        }

        // Reset withdrawer information
        delete accounts[msg.sender];

        // Send ether to withdrawer
        msg.sender.transfer(totalPayable);

        // Record the event
        emit Withdrawal(msg.sender, totalPayable);
    }

}
