/* Change the printed labels without moving or replacing the interactive fields. */
window.createLocalizedSheet = paper => {
  const pages = [...paper.querySelectorAll('.sheet-pdf-page')];
  const metrics = document.createElement('canvas').getContext('2d');
  function box(node, [left, top, width, height]) {
    Object.assign(node.style, {left: left+'%', top: top+'%', width: width+'%', height: height+'%'});
    return node;
  }
  return {
    render(lang) {
      paper.lang = lang;
      for (const page of pages) {
        page.querySelector('.sheet-print-overlay')?.remove();
        if (lang === 'uk') continue;
        const rows = window.cthSheetPrintLabels[page.dataset.page];
        if (!rows) continue;
        const overlay = document.createElement('div');
        overlay.className = 'sheet-print-overlay';
        const labels = document.createDocumentFragment();
        for (const [mask, color, placement, size, weight, vertical, translations] of rows) {
          if(page.dataset.page==='2'&&mask[1]>=76)continue;
          const label = translations[lang === 'ru' ? 0 : 1];
          const cover = box(document.createElement('i'), mask);
          cover.setAttribute('aria-hidden', 'true');
          cover.style.backgroundColor = color;
          overlay.append(cover);

          if(!label)continue;
          const text = document.createElement('span');
          text.className = 'sheet-print-label '+weight+(vertical ? ' vertical' : '');
          text.textContent = label;
          if(weight==='heading'||(size>2.2 && weight==='bold' && !vertical))text.style.justifyContent='center';
          const [x, y, width, height] = placement;
          const length = vertical ? height*810.709/620.787 : width;
          const style=weight==='heading'?'bold':weight;
          metrics.font = (style === 'regular' ? '' : style+' ')+'100px Georgia, serif';
          const ratio = Math.min(1, length/(metrics.measureText(label).width*size/100));
          const fontSize=size*ratio;
          text.style.fontSize=fontSize+'cqw';
          if(page.dataset.page==='2'&&y>23&&y<59){
            const textWidth=metrics.measureText(label).width*fontSize/100;
            // The first rule starts after the label. Open a gap only as wide as the new wording.
            const inkEnd=mask[0]+mask[2];
            const gapEnd=x+textWidth+.45;
            const end=Math.max(inkEnd,gapEnd);
            cover.style.width=(end-mask[0])+'%';
            cover.style.height=(mask[3]+.18)+'%';
            const ruleY=[25.89,34.17,42.38,50.74,58.80].reduce((nearest,rule)=>
              Math.abs(rule-y)<Math.abs(nearest-y)?rule:nearest);
            if(gapEnd<inkEnd){
              const rule=box(document.createElement('i'),[gapEnd,ruleY,inkEnd-gapEnd+.35,0]);
              rule.className='sheet-print-rule';
              rule.setAttribute('aria-hidden','true');
              overlay.append(rule);
            }
          }
          box(text, vertical ? [mask[0],y,mask[2],height] : [x,mask[1],width,mask[3]]);
          labels.append(text);
        }
        overlay.append(labels);
        page.querySelector('.sheet-pdf-layer').before(overlay);
      }

      const portrait = paper.querySelector('.sheet-pdf-portrait');
      if (portrait) {
        const label = {uk:'Додати фото',ru:'Добавить фото',en:'Add photo'}[lang];
        portrait.title = label;
        portrait.querySelector('span').textContent = label;
        portrait.querySelector('input').setAttribute('aria-label',label);
      }
    }
  };
};
