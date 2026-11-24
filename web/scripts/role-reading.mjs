// Short original adaptations for shared reading. Each row is one speaker's turn.
const books = {
  '토끼와 거북이': [
    ['해설','숲길에서 토끼와 거북이가 산꼭대기를 올려다봤어요.'],
    ['토끼','나는 저 고개까지 깡충깡충 달려갈 수 있어!'],
    ['거북이','나도 갈 수 있어. 우리 함께 출발하자.'],
    ['해설','토끼는 금세 앞서갔어요. 거북이는 한 걸음씩 언덕을 올랐지요.'],
    ['토끼','아직 멀리 있네. 나무 그늘에서 좀 쉴까?'],
    ['해설','토끼가 잠든 사이 거북이는 산꼭대기에 올라섰어요.'],
    ['거북이','해냈어! 내 걸음으로 끝까지 왔어.'],
    ['해설','거북이의 목소리에 토끼가 눈을 번쩍 떴어요.'],
  ],
  '금도끼와 은도끼': [
    ['해설','나무꾼의 도끼가 연못에 퐁당 빠졌어요. 물결 사이로 산신령이 올라왔지요.'],
    ['산신령','연못가에 앉아 무슨 걱정을 하니?'],['나무꾼','나무를 하던 낡은 도끼를 잃어버렸어요.'],
    ['산신령','물속에서 금빛 도끼를 찾았단다. 이걸 찾고 있었니?'],['나무꾼','제 것은 그렇게 반짝이지 않아요.'],
    ['산신령','그럼 은빛 나는 이 도끼일까?'],['나무꾼','아니에요. 제 도끼는 쇠로 만들었어요.'],
    ['해설','산신령이 이번에는 손때 묻은 쇠도끼를 내밀었어요.'],['나무꾼','찾았다! 이게 바로 제 도끼예요.'],
    ['산신령','네가 참말을 해 주어 기쁘구나. 다른 두 도끼도 선물로 주마.'],
  ],
  '우렁이 색시': [
    ['해설','텅 빈 집에 돌아가던 농부가 논둑에 앉았어요.'],['농부','나와 한집에서 살 사람이 있을까?'],
    ['우렁이 색시','여기 있어요. 내 목소리가 들리나요?'],['해설','논에는 우렁이 한 마리가 있었어요. 농부는 집 항아리에 우렁이를 옮겼어요. 며칠 동안 저녁마다 따뜻한 밥이 차려졌지요.'],
    ['농부','오늘은 누가 밥을 지어 주는지 기다려 봐야지.'],['해설','항아리에서 한 사람이 나왔어요.'],
    ['농부','혹시 논에서 나와 이야기한 분인가요?'],['우렁이 색시','그래요. 나는 용왕의 딸인데 마법에 걸려 우렁이가 되었어요.'],
    ['농부','우리 함께 살아요.'],['우렁이 색시','좋아요. 이제 내 모습으로 지낼 수 있겠어요.'],['해설','둘은 혼인했고 우렁이의 마법도 풀렸어요.'],
  ],
  '토끼전': [
    ['해설','용왕이 아프자 거북이가 뭍에 올라와 토끼를 찾아갔어요.'],['거북이','토끼야, 내 등에 올라탈래? 바다 궁전에 잔치가 열린단다.'],
    ['토끼','물 아래 궁전이라니! 나도 구경하고 싶어.'],['해설','하지만 궁전에 도착하니 잔치는 없었어요.'],
    ['거북이','사실은 용왕님이 네 간을 구하고 계셔.'],['토끼','그랬어? 내 간은 숲에 두고 왔는데. 다시 데려다줄래?'],
    ['해설','둘은 숲으로 돌아왔어요. 토끼는 거북이 등에서 폴짝 뛰어내렸지요.'],['거북이','자, 어느 나무로 가면 되니?'],
    ['토끼','내 간은 내 몸속에 있지! 나는 이제 집으로 갈래.'],['해설','토끼는 나무 사이로 사라졌어요.'],
  ],
  '단군이야기': [
    ['해설','옛이야기 속 환웅은 하늘에서 땅으로 내려왔어요. 어느 날 곰과 호랑이가 찾아왔어요.'],
    ['곰','환웅님, 저희도 사람이 될 수 있을까요?'],['환웅','이야기 속 동굴에서 쑥과 마늘을 먹으며 백 날을 지내 보렴.'],
    ['해설','동굴 속은 캄캄했어요. 호랑이는 곧 밖으로 뛰어나갔지요.'],
    ['곰','나는 여기서 조금 더 기다려 볼래.'],['해설','스물하루가 지나자 환웅이 곰에게 왔어요.'],
    ['환웅','곰아, 네 소원이 이루어졌구나!'],['해설','사람이 된 곰은 웅녀라는 이름을 얻었어요. 훗날 웅녀와 환웅의 아들 단군은 고조선을 세웠답니다.'],
  ],
};

export const readingTool = {
  type:'function', name:'role_reading',
  description:'번갈아 읽기 대본. 아이가 고른 책과 배역으로 시작한다. 대사를 읽었거나 넘겨 달랄 때만 next. 질문은 답하고 현재 위치 유지.',
  parameters:{type:'object',properties:{
    action:{type:'string',enum:['choose','start','next','repeat','solo','stop']},
    book:{type:'string',enum:Object.keys(books)}, role:{type:'string',description:'아이가 선택한 등장인물 이름'},
  },required:['action'],additionalProperties:false},
};

export function createReader() {
  let book, selectedBook, role, index=0, last;
  function scene() {
    const rows=books[book], narration=[];
    while(index<rows.length && rows[index][0]!==role) narration.push(rows[index++]);
    const cue=rows[index]?.[1] ?? '';
    last={book,role,narration,cue,finished:!cue};
    return last;
  }
  return {
    run(raw) {
      let args;
      try { args=JSON.parse(raw); } catch { return {error:'배역과 책을 다시 확인해.'}; }
      if (!args || typeof args!=='object') return {error:'책과 배역을 물어봐.'};
      if(args.action==='stop'){book=undefined;selectedBook=undefined;last=undefined;return {stopped:true};}
      if(args.action==='choose'||args.action==='start'){
        const title=args.book ?? (args.action==='start' ? selectedBook : undefined);
        if(typeof title!=='string'||!Object.hasOwn(books,title)) return {titles:Object.keys(books)};
        selectedBook=title;
        const roles=[...new Set(books[title].map(row=>row[0]))].filter(name=>name!=='해설');
        if(args.action==='choose'||!roles.includes(args.role))return {title,roles};
        book=title;role=args.role;index=0;return scene();
      }
      if(!book||!last)return {titles:Object.keys(books)};
      if(args.action==='repeat')return last;
      if(last.finished)return {...last,narration:[]};
      if(args.action==='solo'){role=null;return scene();}
      if(args.action==='next'){index++;return scene();}
      return {error:'현재 차례를 확인해.'};
    },
    current(){return last;},
  };
}
