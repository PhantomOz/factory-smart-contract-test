const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;
    const label = "MacBook M3";
    const bankAddr = ethers.ZeroAddress;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(unlockTime, label, bankAddr, {
      value: lockedAmount,
    });

    return {
      lock,
      unlockTime,
      lockedAmount,
      owner,
      otherAccount,
      label,
      bankAddr,
    };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.getUnlockTime()).to.equal(unlockTime);
    });

    it("Should set the right owner", async function () {
      const { lock, owner } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.getOwner()).to.equal(owner.address);
    });

    it("Should set the right label", async function () {
      const { lock, label } = await loadFixture(deployOneYearLockFixture);
      expect(await lock.getLabel()).to.equal(label);
    });

    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount } = await loadFixture(
        deployOneYearLockFixture
      );

      expect(await ethers.provider.getBalance(lock.target)).to.equal(
        lockedAmount
      );
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      // We don't use the fixture here because we want a different deployment
      const latestTime = await time.latest();
      const Lock = await ethers.getContractFactory("Lock");
      const bankAddr = await ethers.ZeroAddress;
      await expect(Lock.deploy(latestTime, "Mac", bankAddr, { value: 1 }))
        .to.be.revertedWithCustomError(Lock, "Invalid__Unlock__Time")
        .withArgs("Unlock time should be in the future");
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should deduct 10% if called too soon", async function () {
        const { lock, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );
        await lock.withdraw();
        await expect(await lock.getLockBalance()).to.equal(0);
      });

      it("Should have the 10% deducted", async function () {
        const { lock, lockedAmount, bankAddr } = await loadFixture(
          deployOneYearLockFixture
        );
        await lock.withdraw();
        await expect(await ethers.provider.getBalance(bankAddr)).to.equal(
          lockedAmount * 0.1
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime);

        // We use lock.connect() to send a transaction from another account
        await expect(lock.connect(otherAccount).withdraw())
          .to.be.revertedWithCustomError(lock, "Not__Owner")
          .withArgs(otherAccount);
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        );

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).not.to.be.reverted;
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
      });

      it("Should emit an event on smash", async function () {
        const { lock, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );
        const amount = lockedAmount - lockedAmount * 0.1;
        await expect(await lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(amount, anyValue);
      });
    });

    describe("Transfers", function () {
      it("Should transfer the funds to the owner", async function () {
        const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw()).to.changeEtherBalances(
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  });
});
