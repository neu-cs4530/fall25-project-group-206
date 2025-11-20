import './index.css';
import OrderButton from './orderButton';
import { OrderType } from '../../../../types/types';
import { orderTypeDisplayName } from '../../../../types/constants';
import AskQuestionButton from '../../askQuestionButton';
import { useState } from 'react';

interface QuestionHeaderProps {
  titleText: string;
  qcnt: number;
  setQuestionOrder: (order: OrderType) => void;
}

const QuestionHeader = ({ titleText, qcnt, setQuestionOrder }: QuestionHeaderProps) => {
  const [activeOrder, setActiveOrder] = useState<OrderType>('newest');

  const handleOrderChange = (order: OrderType) => {
    setActiveOrder(order);
    setQuestionOrder(order);
  };

  return (
    <div className='question-header-wrapper'>
      <div className='space_between right_padding'>
        <div className='bold_title'>{titleText}</div>
        <AskQuestionButton />
      </div>
      <div className='space_between right_padding'>
        <div id='question_count'>{qcnt} questions</div>
        <div className='btns'>
          {Object.keys(orderTypeDisplayName).map(order => (
            <OrderButton
              key={order}
              orderType={order as OrderType}
              setQuestionOrder={handleOrderChange}
              isActive={activeOrder === order}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuestionHeader;
