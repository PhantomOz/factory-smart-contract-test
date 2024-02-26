const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bank", function () {
  async function deployBank() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    const [owner, otherAccount] = await ethers.getSigners();

    const Bank = await ethers.getContractFactory("Bank");
    const bank = await Bank.deploy();

    return { bank, owner, otherAccount, lockedAmount, unlockTime };
  }

  describe("Deployment", function () {
    it("Should get owner as the deployer of the contract", async function () {
      const { bank, owner } = await loadFixture(deployBank);
      expect(await bank.getOwner()).to.equal(owner);
    });
  });
  describe("Fund Lock", function () {
    it("Should create a new lock and fund it", async function () {
      const { bank, owner, unlockTime, lockedAmount } = await loadFixture(
        deployBank
      );
      await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
      expect(await bank.getOwnerLocksLength(owner)).to.equal(1);
    });
    it("Should have a lock index of zero", async function () {
      const { bank, owner, unlockTime, lockedAmount } = await loadFixture(
        deployBank
      );
      await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
      let locks = await bank.getUserLocks(owner);
      let addr = await ethers.getAddress(locks[0]);
      expect(await bank.getLockIndex(addr, owner)).to.equal(0);
    });
    it("Should have a bank of locked amount", async function () {
      const { bank, owner, unlockTime, lockedAmount } = await loadFixture(
        deployBank
      );
      await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
      let locks = await bank.getUserLocks(owner);
      let addr = await ethers.getAddress(locks[0]);
      let { balance } = await bank.getLockDetails(addr, owner);
      expect(await balance).to.equal(lockedAmount);
    });
  });
  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should deduct 10% if called too soon", async function () {
        const { bank, owner, unlockTime, lockedAmount } = await loadFixture(
          deployBank
        );
        await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
        let locks = await bank.getUserLocks(owner);
        let addr = await ethers.getAddress(locks[0]);
        await bank.withdrawLock(addr);
        let { balance } = await bank.getLockDetails(addr, owner);
        expect(await balance).to.equal(0);
      });

      it("Should have the 10% deducted", async function () {
        const { bank, owner, unlockTime, lockedAmount } = await loadFixture(
          deployBank
        );
        await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
        let locks = await bank.getUserLocks(owner);
        let addr = await ethers.getAddress(locks[0]);
        await bank.withdrawLock(addr);
        expect(await ethers.provider.getBalance(bank)).to.equal(lockedAmount);
      });

      it("Should revert with the right error if called from another account", async function () {
        const { bank, owner, otherAccount, unlockTime, lockedAmount } =
          await loadFixture(deployBank);
        const Lock = await ethers.getContractFactory("Lock");
        await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
        let locks = await bank.getUserLocks(owner);
        let addr = await ethers.getAddress(locks[0]);
        await expect(
          bank.connect(otherAccount).withdrawLock(addr)
        ).to.be.revertedWithPanic();
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { bank, owner, unlockTime, lockedAmount } = await loadFixture(
          deployBank
        );
        await bank.lockFunds(unlockTime, "Mac", { value: lockedAmount });
        let locks = await bank.getUserLocks(owner);
        let addr = await ethers.getAddress(locks[0]);
        await time.increaseTo(unlockTime);
        await expect(bank.withdrawLock(addr)).not.to.be.reverted;
      });

      it("Should withdraw everything in the bank", async function () {
        const { bank, owner, otherAccount, unlockTime, lockedAmount } =
          await loadFixture(deployBank);
        await bank
          .connect(otherAccount)
          .lockFunds(unlockTime, "Mac", { value: lockedAmount });
        let locks = await bank.getUserLocks(otherAccount);
        let addr = await ethers.getAddress(locks[0]);
        await bank.connect(otherAccount).withdrawLock(addr);
        const bal = await ethers.provider.getBalance(bank);
        const totalBal = (await ethers.provider.getBalance(owner)) + bal;
        await bank.withdrawBank();
        await expect(
          await ethers.provider.getBalance(owner)
        ).to.be.lessThanOrEqual(totalBal);
      });

      it("Should revert if it is not owner that called", async function () {
        const { bank, owner, otherAccount, unlockTime, lockedAmount } =
          await loadFixture(deployBank);
        const Bank = await ethers.getContractFactory("Bank");
        await expect(bank.connect(otherAccount).withdrawBank())
          .to.be.revertedWithCustomError(Bank, "Not__Owner")
          .withArgs(anyValue);
      });
    });
  });
});
