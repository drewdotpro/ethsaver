require('truffle-test-utils').init();
const InterestByFee = artifacts.require("InterestByFee");
const BigNumber = require('bignumber.js');
contract('InterestByFee', accounts => {
    const [
        owner,
        singleUseAccount,
        multipleDepositAccount,
        feeOffsetTestAccountA,
        feeOffsetTestAccountB,
        feeOffsetTestAccountC,
        withdrawerFirst,
        withdrawerSecond,
        withdrawerThird,
    ] = accounts;
    const gasPrice = web3.toWei(1, 'gwei');

    describe('deposit', () => {
        let instance;
        before(async () => {
            instance = await InterestByFee.new({from: owner, gasPrice});
        });
        it('Should reject a transaction that has no value', async () => {
            try {
                await instance.deposit({from: singleUseAccount, gasPrice});
                const badEx = new Error('Expected contract to revert');
                badEx.throwMe = true;
            } catch (e) {
                if (e.throwMe) {
                    throw e;
                }
            }
        });

        it('Should take a user deposit, and record it', async () => {
            const preCollectedFees = await instance.collectedFees.call();
            assert.equal(preCollectedFees.toNumber(), 0, 'fees are zero');

            const result = await instance.deposit({value: 100, from: singleUseAccount, gasPrice});

            const postCollectedFees = await instance.collectedFees.call();
            const postTotalUserBalances = await instance.totalUserBalances.call();
            const [postBalance, postFeeOffset] = await instance.accounts(singleUseAccount);

            assert.equal(postCollectedFees.toNumber(), 0, 'fees do not increase');
            assert.equal(postTotalUserBalances.toNumber(), 100, 'total user deposit amount increases');
            assert.equal(postBalance.toNumber(), 100, 'user deposit amount increases');
            assert.equal(postFeeOffset.toNumber(), 0, 'user fee offset is set');

            assert.web3Event(result, {
                event: 'Deposit',
                args: {
                    depositor: singleUseAccount,
                    amount: 100,
                }
            }, 'The event is emitted');
        });

        it('Should reject a second user deposit', async () => {
            const preTotalUserBalances = await instance.totalUserBalances.call();

            const result = await instance.deposit({value: 100, from: multipleDepositAccount, gasPrice});

            const postCollectedFees = await instance.collectedFees.call();
            const postTotalUserBalances = await instance.totalUserBalances.call();
            const [postBalance, postFeeOffset] = await instance.accounts(multipleDepositAccount);

            assert.equal(postCollectedFees.toNumber(), 0, 'fees do not increase');
            assert.equal(postTotalUserBalances.toNumber() - preTotalUserBalances.toNumber(), 100, 'total user deposit amount increases');
            assert.equal(postBalance.toNumber(), 100, 'user deposit amount increases');
            assert.equal(postFeeOffset.toNumber(), 0, 'user fee offset is set');

            assert.web3Event(result, {
                event: 'Deposit',
                args: {depositor: multipleDepositAccount, amount: 100}
            }, 'The event is emitted');

            try {
                await instance.deposit({value: 100, from: multipleDepositAccount, gasPrice});
                const badEx = new Error('Expected contract to revert');
                badEx.throwMe = true;
            } catch (e) {
                if (e.throwMe) {
                    throw e;
                }
            }
        });

        it('Should set the feeOffset if some fees have already been claimed', async () => {
            const setup = async () => {
                const preCollectedFees = await instance.collectedFees.call();
                assert.equal(preCollectedFees.toNumber(), 0, 'pre collected fees are zero to start');

                await instance.deposit({value: 100, from: feeOffsetTestAccountA, gasPrice});
                const [withdrawerBalance] = await instance.accounts(feeOffsetTestAccountA);
                await instance.accounts(feeOffsetTestAccountB);
                assert.equal(withdrawerBalance.toNumber(), 100, 'account about to withdraw from has funds');
                await instance.withdraw({from: multipleDepositAccount, gasPrice});

                const postCollectedFees = await instance.collectedFees.call();
                assert.equal(postCollectedFees.toNumber(), 10, 'post collected fees are 10');
            };

            await setup();
            await instance.deposit({value: 100, from: feeOffsetTestAccountC, gasPrice});
            const [postBalance, postFeeOffset] = await instance.accounts(feeOffsetTestAccountC);
            assert.equal(postBalance.toNumber(), 100, 'user has balance');
            assert.equal(postFeeOffset.toNumber(), 10, 'user fee offset is set');

        });
    });
    describe('withdraw', () => {
        let instance;
        beforeEach(async () => {
            instance = await InterestByFee.new({from: owner, gasPrice});
        });
        it('should reject if the user has no balance', async () => {
            try {
                await instance.withdraw({from: withdrawerFirst, gasPrice});
                const badEx = new Error('Expected contract to revert');
                badEx.throwMe = true;
            } catch (e) {
                if (e.throwMe) {
                    throw e;
                }
            }
        });
        it('should withdraw the whole balance with no fee if the user is 100% of the total balance', async () => {
            await instance.deposit({value: 100, from: withdrawerFirst, gasPrice});
            const totalUserBalances = await instance.totalUserBalances.call();
            const [userBalance] = await instance.accounts(withdrawerFirst);
            assert.equal(totalUserBalances.toNumber(), userBalance.toNumber(), 'user has 100% of total balances');

            const preWithdrawalBalance = await web3.eth.getBalance(withdrawerFirst);

            const result = await instance.withdraw({from: withdrawerFirst, gasPrice});
            const postTotalUserBalances = await instance.totalUserBalances.call();
            const collectedFees = await instance.collectedFees.call();
            const [postUserBalance] = await instance.accounts(withdrawerFirst);
            assert.equal(collectedFees, 0, 'fees collected are zero');
            assert.equal(postTotalUserBalances, 0, 'user balances are zero');
            assert.equal(postUserBalance, 0, 'user balance is zero');

            const postWithdrawalBalance = await web3.eth.getBalance(withdrawerFirst);
            const etherUsed = new BigNumber(result.receipt.gasUsed).times(gasPrice);
            const expectedUserBalance = new BigNumber(preWithdrawalBalance).plus(100).minus(etherUsed);

            assert.equal(postWithdrawalBalance.toNumber(), expectedUserBalance.toNumber(), 'user has received the withdrawal');

            assert.web3Event(result, {
                event: 'Withdrawal',
                args: {
                    depositor: withdrawerFirst,
                    amount: 100,
                }
            }, 'The event is emitted');
        });
        it('should withdraw the user balance plus accured income minus fee if the user is not 100% of the total balance', async () => {
            await instance.deposit({value: 101, from: withdrawerFirst, gasPrice});
            await instance.deposit({value: 101, from: withdrawerSecond, gasPrice});
            const totalUserBalances = await instance.totalUserBalances.call();
            assert.equal(totalUserBalances.toNumber(), 202, 'user balances has the total of 2 deposits');

            // First withdrawal gets 90 as no fees so far
            const preWithdrawalBalance = await web3.eth.getBalance(withdrawerFirst);
            const resultA = await instance.withdraw({from: withdrawerFirst, gasPrice});
            const postTotalUserBalances = await instance.totalUserBalances.call();
            const collectedFees = await instance.collectedFees.call();
            const [postUserBalance] = await instance.accounts(withdrawerFirst);
            assert.equal(collectedFees, 10, 'fees collected are 10');
            assert.equal(postTotalUserBalances, 101, 'user balances is 101');
            assert.equal(postUserBalance, 0, 'user balance is zero');
            const postWithdrawalBalance = await web3.eth.getBalance(withdrawerFirst);
            const etherUsed = new BigNumber(resultA.receipt.gasUsed).times(gasPrice);
            const expectedUserBalance = new BigNumber(preWithdrawalBalance).plus(90).minus(etherUsed);
            assert.equal(postWithdrawalBalance.toNumber(), expectedUserBalance.toNumber(), 'user has received the withdrawal');
            assert.web3Event(resultA, {
                event: 'Withdrawal',
                args: {
                    depositor: withdrawerFirst,
                    amount: 91,
                }
            }, 'The event is emitted');

            // Third deposit will have a feeOffset of 10
            await instance.deposit({value: 303, from: withdrawerThird, gasPrice});

            // CONTRACT FLAWED
            // Each withdrawal fee should only be spread among depositors before the withdrawal was made, but as
            // the fee share is split against depositor share of total balance then a deposit after a withdrawal skews the total
            assert.isFalse(true, 'flawed contract')


        });
    });
});
