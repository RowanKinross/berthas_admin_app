// import berthasLogo from '../bertha_logo'
import './home.css'

function Home() {
  return (
    <div className='home'>
      {/* <img src={berthasLogo} className="logo berthasLogo" alt="Bertha's Logo" /> */}
      <h2>Welcome to Bertha's Frozen Pizza Admin App </h2>
      <div className='loginContainer'>
        <button> Customer Login </button>
        <button> Staff Login </button>
      </div>
    </div>
  )
}

export default Home;