document.addEventListener("DOMContentLoaded", () => {
  const scoreForm = document.getElementById("scoreForm");
  const statsContainer = document.getElementById("stats");

  scoreForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const game1Input = document.getElementById("game1");
    const game2Input = document.getElementById("game2");
    const game3Input = document.getElementById("game3");

    const game1 = parseInt(game1Input.value);
    const game2 = parseInt(game2Input.value);
    const game3 = parseInt(game3Input.value);

    try {
      await addScores({ game1, game2, game3 });
      updateStats();
      game1Input.value = "";
      game2Input.value = "";
      game3Input.value = "";
    } catch (error) {
      console.error("Error adding scores:", error.message);
    }
  });

  async function addScores({ game1, game2, game3 }) {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ game1, game2, game3 }),
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
          <p>Game 1: ${data.game1}</p>
          <p>Game 2: ${data.game2}</p>
          <p>Game 3: ${data.game3}</p>
          <p>Total Score: ${data.total.toFixed(2)}</p>
          <p>Average Score: ${data.average.toFixed(2)}</p>
        `;
    } catch (error) {
      console.error("Error fetching statistics:", error.message);
    }
  }
});
