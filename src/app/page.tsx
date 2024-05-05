// Import the Link component at the top of your file
import Link from 'next/link';

const Home = () => {
  return (
    <div>
      <h1>Welcome to the Home Page</h1>
      {/* Use Link to navigate to the video page */}
      <Link href="/video">
        <button type="button">Watch Video</button>
      </Link>
    </div>
  );
};

export default Home;
