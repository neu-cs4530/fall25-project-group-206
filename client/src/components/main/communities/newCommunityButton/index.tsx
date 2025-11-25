import './index.css';
import useNewCommunityButton from '../../../../hooks/useNewCommunityButton';

/**
 * NewCommunityButton component provides a button to create a new community.
 * @returns JSX.Element representing the new community button.
 */
const NewCommunityButton = () => {
  const { handleClick } = useNewCommunityButton();

  return (
    <button className='new-community-button' onClick={handleClick}>
      Create
    </button>
  );
};

export default NewCommunityButton;
