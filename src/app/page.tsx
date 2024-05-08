// src/pages/index.tsx
import Link from "next/link";

const Home = () => {
  return (
    <div>
      <h1>Welcome to the Home Page</h1>
      <Link href="/video">
        <button type="button">Watch Video</button>
      </Link>
      <Link href="/test">
        <button type="button">Go to Test Page</button>
      </Link>
    </div>
  );
};

export default Home;
