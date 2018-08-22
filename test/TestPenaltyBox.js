require('truffle-test-utils').init();
const PenaltyBox = artifacts.require("PenaltyBoxMock");
const BigNumber = require('bignumber.js');
contract('PenaltyBox', accounts => {
  const gasPrice = web3.toWei(1, 'gwei');
  const [owner, depositor] = accounts;

  describe('Constructor', () => {
    it('should have an owner set', async () => {
      const instance = await PenaltyBox.new({from: owner, gasPrice});
      assert.equal(await instance.owner.call(), accounts[0], 'The instance owner is owner');
    });
  });

  describe('deposit', () => {
    let instance;
    beforeEach(async () => {
      instance = await PenaltyBox.new({from: owner, gasPrice});
    });
    it('should reject a deposit with a releaseTime in the past', async () => {
      try {
        const now = web3.eth.getBlock('latest').timestamp;
        await instance.deposit(now - 100000, {value: web3.toWei(1, "ether"), from: depositor, gasPrice});
        const badEx = new Error('Expected contract to revert');
        badEx.throwMe = true;
      } catch (e) {
        if (e.throwMe) {
          throw e;
        }
      }
    });

    it('should reject a deposit under 10 wei', async () => {
      try {
        const now = web3.eth.getBlock('latest').timestamp;
        await instance.deposit(now + 100000, {value: 9, from: depositor, gasPrice});
        const badEx = new Error('Expected contract to revert');
        badEx.throwMe = true;
      } catch (e) {
        if (e.throwMe) {
          throw e;
        }
      }
    });

    it('should accept a deposit in the future over 10 wei', async () => {
      const preBalance = await web3.eth.getBalance(depositor);
      const now = web3.eth.getBlock('latest').timestamp;
      const expectedReleaseTime = now + 100000;
      const expectedBalance = web3.toWei(0.1, 'ether');
      const depositAmount = web3.toWei(0.1, "ether");

      const result = await instance.deposit(expectedReleaseTime, {
        value: depositAmount,
        from: depositor,
        gasPrice
      });
      const postBalance = await web3.eth.getBalance(depositor);
      const [balance, releaseTime] = await instance.accounts.call(depositor);
      assert.equal(balance.toString(), expectedBalance, 'The balance is correct');
      assert.equal(releaseTime.toString(), expectedReleaseTime, 'The release time is correct');
      const etherUsed = new BigNumber(result.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalance = preBalance.minus(depositAmount).minus(etherUsed);
      assert.equal(expectedAccountBalance.toString(), postBalance.toString(), 'The account balance is correct');
    });


    it('should send a deposit event, increasing the balance each time', async () => {
      const now = web3.eth.getBlock('latest').timestamp;
      const depositAmount = web3.toWei(0.1, "ether");
      const releaseTimeA = now + 100000;
      const releaseTimeB = now + 200000;
      const resultA = await instance.deposit(releaseTimeA, {value: depositAmount, from: depositor, gasPrice});
      assert.web3Event(resultA, {
        event: 'Deposit',
        args: {
          depositor: depositor,
          amount: 100000000000000000,
          balance: 100000000000000000,
          releaseTime: releaseTimeA,
        }
      }, 'The event is emitted');
      const resultB = await instance.deposit(releaseTimeB, {value: depositAmount, from: depositor, gasPrice});
      assert.web3Event(resultB, {
        event: 'Deposit',
        args: {
          depositor: depositor,
          amount: 100000000000000000,
          balance: 200000000000000000,
          releaseTime: releaseTimeB,
        }
      }, 'The event is emitted');
    });

    it('should append a deposit and increase the releaseTime if higher', async () => {
      const preBalance = await web3.eth.getBalance(depositor);
      const now = web3.eth.getBlock('latest').timestamp;
      const expectedReleaseTimeA = now + 100000;
      const expectedReleaseTimeB = now + 200000;
      const expectedBalanceA = web3.toWei(0.1, 'ether');
      const expectedBalanceB = web3.toWei(0.3, 'ether');
      const depositAmountA = web3.toWei(0.1, "ether");
      const depositAmountB = web3.toWei(0.2, "ether");

      const resultA = await instance.deposit(expectedReleaseTimeA, {
        value: depositAmountA,
        from: depositor,
        gasPrice
      });
      const postBalanceA = await web3.eth.getBalance(depositor);
      const [balanceA, releaseTimeA] = await instance.accounts.call(depositor);
      assert.equal(balanceA.toString(), expectedBalanceA, 'The balance is correct');
      assert.equal(releaseTimeA.toString(), expectedReleaseTimeA, 'The release time is correct');
      const etherUsedA = new BigNumber(resultA.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceA = preBalance.minus(depositAmountA).minus(etherUsedA);
      assert.equal(expectedAccountBalanceA.toString(), postBalanceA.toString(), 'The account balance is correct');

      const resultB = await instance.deposit(expectedReleaseTimeB, {
        value: depositAmountB,
        from: depositor,
        gasPrice
      });
      const postBalanceB = await web3.eth.getBalance(depositor);
      const [balanceB, releaseTimeB] = await instance.accounts.call(depositor);
      assert.equal(balanceB.toString(), expectedBalanceB, 'The balance is correct');
      assert.equal(releaseTimeB.toString(), expectedReleaseTimeB, 'The release time is correct');
      const etherUsedB = new BigNumber(resultB.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceB = postBalanceA.minus(depositAmountB).minus(etherUsedB);
      assert.equal(expectedAccountBalanceB.toString(), postBalanceB.toString(), 'The account balance is correct');
    });

    it('should append a deposit and not increase the releaseTime if lower', async () => {
      const preBalance = await web3.eth.getBalance(depositor);
      const now = web3.eth.getBlock('latest').timestamp;
      const expectedReleaseTimeA = now + 100000;
      const sentReleaseTimeB = now + 50000;
      const expectedBalanceA = web3.toWei(0.1, 'ether');
      const expectedBalanceB = web3.toWei(0.3, 'ether');
      const depositAmountA = web3.toWei(0.1, "ether");
      const depositAmountB = web3.toWei(0.2, "ether");

      const resultA = await instance.deposit(expectedReleaseTimeA, {
        value: depositAmountA,
        from: depositor,
        gasPrice
      });
      const postBalanceA = await web3.eth.getBalance(depositor);
      const [balanceA, releaseTimeA] = await instance.accounts.call(depositor);
      assert.equal(balanceA.toString(), expectedBalanceA, 'The balance is correct');
      assert.equal(releaseTimeA.toString(), expectedReleaseTimeA, 'The release time is correct');
      const etherUsedA = new BigNumber(resultA.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceA = preBalance.minus(depositAmountA).minus(etherUsedA);
      assert.equal(expectedAccountBalanceA.toString(), postBalanceA.toString(), 'The account balance is correct');

      const resultB = await instance.deposit(sentReleaseTimeB, {
        value: depositAmountB,
        from: depositor,
        gasPrice
      });
      const postBalanceB = await web3.eth.getBalance(depositor);
      const [balanceB, releaseTimeB] = await instance.accounts.call(depositor);
      assert.equal(balanceB.toString(), expectedBalanceB, 'The balance is correct');
      assert.equal(releaseTimeB.toString(), expectedReleaseTimeA, 'The release time is correct');
      const etherUsedB = new BigNumber(resultB.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceB = postBalanceA.minus(depositAmountB).minus(etherUsedB);
      assert.equal(expectedAccountBalanceB.toString(), postBalanceB.toString(), 'The account balance is correct');
    });
  });
  describe('withdraw', () => {
    let instance;
    beforeEach(async () => {
      instance = await PenaltyBox.new({from: owner, gasPrice});
    });

    it('should reject a withdrawal attempt for a user who does not have any funds', async () => {
      try {
        await instance.withdraw(false, {from: depositor, gasPrice});
        const badEx = new Error('Expected contract to revert');
        badEx.throwMe = true;
      } catch (e) {
        if (e.throwMe) {
          throw e;
        }
      }
    });

    it('should reject a withdrawal attempt for a user who is before the allowed withdrawal time without early withdrawal agreement', async () => {
      const now = web3.eth.getBlock('latest').timestamp;
      await instance.deposit(now + 10, {value: web3.toWei(0.1, "ether"), from: depositor, gasPrice});
      try {
        await instance.withdraw(false, {from: depositor, gasPrice});
        const badEx = new Error('Expected contract to revert');
        badEx.throwMe = true;
      } catch (e) {
        if (e.throwMe) {
          throw e;
        }
      }
    });

    it('should accept a withdrawal for a user who is after withdrawal time', async () => {
      const now = web3.eth.getBlock('latest').timestamp;
      const startBalance = await web3.eth.getBalance(depositor);
      const depositAmount = web3.toWei(0.1, "ether");

      const resultA = await instance.deposit(now + 10, {value: depositAmount, from: depositor, gasPrice});
      const postDepositBalance = await web3.eth.getBalance(depositor);
      const etherUsedA = new BigNumber(resultA.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceA = startBalance.minus(depositAmount).minus(etherUsedA);
      assert.equal(expectedAccountBalanceA.toString(), postDepositBalance.toString(), 'The account balance is correct (a)');

      await instance.setNow(now + 10);
      const resultB = await instance.withdraw(false, {from: depositor, gasPrice});
      const postWithawalBalance = await web3.eth.getBalance(depositor);
      const etherUsedB = new BigNumber(resultB.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceB = postDepositBalance.plus(web3.toWei(0.1, "ether")).minus(etherUsedB);
      assert.equal(expectedAccountBalanceB.toString(), postWithawalBalance.toString(), 'The account balance is correct (b)');
      assert.web3Event(resultB, {
        event: 'Withdrawal',
        args: {
          depositor: depositor,
          amount: 100000000000000000,
        }
      }, 'The event is emitted');
    });
    it('should send a percentage to owner address if early withdrawal is agreed and it is early', async () => {
      const now = web3.eth.getBlock('latest').timestamp;
      //Reset to standard 'now'
      await instance.setNow(0);
      const startBalance = await web3.eth.getBalance(depositor);
      const depositAmount = web3.toWei(0.1, "ether");

      const resultA = await instance.deposit(now + 10, {value: depositAmount, from: depositor, gasPrice});
      const postDepositBalance = await web3.eth.getBalance(depositor);
      const etherUsedA = new BigNumber(resultA.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceA = startBalance.minus(depositAmount).minus(etherUsedA);
      assert.equal(expectedAccountBalanceA.toString(), postDepositBalance.toString(), 'The account balance is correct (a)');
      const preBalance = await web3.eth.getBalance(owner);

      const resultB = await instance.withdraw(true, {from: depositor, gasPrice});
      const postWithawalBalance = await web3.eth.getBalance(depositor);
      const etherUsedB = new BigNumber(resultB.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceB = postDepositBalance.plus(web3.toWei(0.09, "ether")).minus(etherUsedB);
      assert.equal(expectedAccountBalanceB.toString(), postWithawalBalance.toString(), 'The account balance is correct (b)');
      assert.web3Event(resultB, {
        event: 'Withdrawal',
        args: {
          depositor: depositor,
          amount: 90000000000000000,
        }
      }, 'The event is emitted');

      const postBalance = await web3.eth.getBalance(owner);
      const expectedFee = web3.toWei(0.01, "ether");
      const expectedPostBalance = preBalance.plus(expectedFee);
      assert.equal(postBalance.toString(), expectedPostBalance.toString(), 'The fee is sent');
    });
    it('should not send a percentage to owner address if early withdrawal is agreed but it is not early', async () => {
      const now = web3.eth.getBlock('latest').timestamp;
      const startBalance = await web3.eth.getBalance(depositor);
      const depositAmount = web3.toWei(0.1, "ether");

      const resultA = await instance.deposit(now + 10, {value: depositAmount, from: depositor, gasPrice});
      const postDepositBalance = await web3.eth.getBalance(depositor);
      const etherUsedA = new BigNumber(resultA.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceA = startBalance.minus(depositAmount).minus(etherUsedA);
      assert.equal(expectedAccountBalanceA.toString(), postDepositBalance.toString(), 'The account balance is correct (a)');

      await instance.setNow(now + 10);
      const preBalance = await web3.eth.getBalance(owner);
      const resultB = await instance.withdraw(true, {from: depositor, gasPrice});
      const postWithawalBalance = await web3.eth.getBalance(depositor);
      const etherUsedB = new BigNumber(resultB.receipt.gasUsed).times(gasPrice);
      const expectedAccountBalanceB = postDepositBalance.plus(web3.toWei(0.1, "ether")).minus(etherUsedB);
      assert.equal(expectedAccountBalanceB.toString(), postWithawalBalance.toString(), 'The account balance is correct (b)');
      assert.web3Event(resultB, {
        event: 'Withdrawal',
        args: {
          depositor: depositor,
          amount: 100000000000000000,
        }
      }, 'The event is emitted');

      const postBalance = await web3.eth.getBalance(owner);
      assert.equal(postBalance.toString(), preBalance.toString(), 'No fee is sent');
    });
  });

});
