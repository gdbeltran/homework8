document.addEventListener("DOMContentLoaded", () => {
  const scoreForm = document.getElementById("scoreForm");
  const statsContainer = document.getElementById("stats");

  scoreForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const scoreInput = document.getElementById("score");
    const score = parseInt(scoreInput.value);

    try {
      await addScore(score);
      updateStats();
      scoreInput.value = "";
    } catch (error) {
      console.error("Error adding score:", error.message);
    }
  });

  async function addScore(score) {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ score }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
  }

  async function updateStats() {
    try {
      const response = await fetch("/api/stats");
      const data = await response.json();

      statsContainer.innerHTML = `
          <h2>Statistics</h2>
          <p>Total Scores: ${data.totalScores}</p>
          <p>Average Score: ${data.averageScore.toFixed(2)}</p>
          <p>Highest Score: ${data.highestScore}</p>
          <p>Lowest Score: ${data.lowestScore}</p>
        `;
    } catch (error) {
      console.error("Error fetching statistics:", error.message);
    }
  }
});
