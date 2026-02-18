'use client';

export default function AboutSection() {
  return (
    <section className="landingAbout" id="about">
      <div className="landingAboutInner">
        <div className="landingDivider">
          <span className="landingDividerLine" />
          <span className="landingDividerIcon">&#9830;&#9827;</span>
          <span className="landingDividerLine" />
        </div>
        <h2 className="landingAboutTitle">About</h2>
        <p className="landingAboutText">
          Ante is a multiplayer crypto board game on Base. Stake ETH, roll dice,
          land on properties, and play casino minigames to win &mdash; or lose &mdash; it all.
          The pot goes to the last player standing.
        </p>
        <img
          src="/assets/misc/casino-crest.webp"
          alt=""
          className="landingAboutCrest"
        />
      </div>
    </section>
  );
}
