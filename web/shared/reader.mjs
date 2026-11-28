export function createReader(books) {
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
      try { args=JSON.parse(raw); } catch { return {error:'책 읽기를 시작하지 못했어.'}; }
      if (!args || typeof args!=='object') return {error:'책 읽기를 시작하지 못했어.'};
      if(args.action==='stop'){book=undefined;selectedBook=undefined;last=undefined;return {stopped:true};}
      if(args.action==='read'){
        const titles=Object.keys(books);
        const title=args.book ?? titles[Math.floor(Math.random()*titles.length)];
        if(!title || !Object.hasOwn(books,title)) return {error:'요청한 책을 서재에서 찾지 못했어.',titles};
        book=selectedBook=title;role=null;index=0;
        return {...scene(),announceTitle:true};
      }
      if(args.action==='choose'||args.action==='start'){
        const titles=Object.keys(books);
        const title=args.book ?? (args.action==='start' ? selectedBook ??
          titles.find(name => books[name].some(([speaker]) => speaker !== '해설' && (!args.role || speaker === args.role))) : undefined);
        if(typeof title!=='string'||!Object.hasOwn(books,title)) return {titles:Object.keys(books)};
        selectedBook=title;
        const roles=[...new Set(books[title].map(row=>row[0]))].filter(name=>name!=='해설');
        if(args.action==='choose'||!roles.length||(args.role && !roles.includes(args.role)))return {title,roles};
        book=title;role=args.role ?? roles[0];index=0;return scene();
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
