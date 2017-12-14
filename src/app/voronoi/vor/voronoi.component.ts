import { Component, Input, OnInit } from '@angular/core';

import { Point, Events, Site, DCEL, BTree, HalfEdge, SitePair } from '../ds/all-elements';
import { BSTree } from 'typescript-collections';

@Component({
  selector: 'voronoi',
  templateUrl: './voronoi.component.html',
  styleUrls: ['./voronoi.component.css']
})
export class VoronoiComponent implements OnInit {

  @Input() yMax: number;
  @Input() yMin: number;
  @Input() xMax: number;
  @Input() xMin: number;
  // should be more than 2 points
  @Input() points: Array<Point>;
  private events: Events;
  private dcel = new DCEL();
  private tree: BTree;
  private sideIdCounter = 0;

  ngOnInit() {

    // get y -> x prioritized events
    
    this.events = new Events(this.points);



    let site1 = new Site(this.events.pop(), this.sideIdCounter++);
    let site2 = new Site(this.events.pop(), this.sideIdCounter++);


    if (site1.point.x < site2.point.x) {
      let newSitePair = new SitePair(site1, site2);

      let newHalfEdge = new HalfEdge(site1, site2);
      newHalfEdge.populateEdgeAndTwinInfo(newSitePair);
      this.dcel.add(newHalfEdge);

      this.tree = new BTree(newSitePair, this.dcel);
    } else {
      let newSitePair = new SitePair(site2, site1);

      let newHalfEdge = new HalfEdge(site2, site1);
      newHalfEdge.populateEdgeAndTwinInfo(newSitePair);
      this.dcel.add(newHalfEdge);

      this.tree = new BTree(newSitePair, this.dcel);
    }

    while (!this.events.isEmpty()) {
      let event = this.events.pop();
      this.handleEvent(event, this.tree, this.dcel);
    }
  }

  private handleEvent(event: Point, T: BTree, D: DCEL): void {
    if (this.points.indexOf(event) >= 0) {
      this.handleSiteEvent(event, T, D);
    } else {
      this.handleCircleEvent(event, T, D);
    }
  }

  private handleSiteEvent(event: Point, T: BTree, D: DCEL): void {
    let site = new Site(event, this.sideIdCounter++);

    let nodeAtWhichSiteWasAdded = T.add(site, D);
    let circleEvents = this.dcel.checkAndGetCircleEvents();
    this.events.addCircleEvents(circleEvents);
    nodeAtWhichSiteWasAdded.potentialCircleEvents = circleEvents;
  }

  private handleCircleEvent(event: Point, T: BTree, D: DCEL): void {
    let nodeFormedDueToSiteRemoval = T.delete(T, event, D);
    let circleEvents = this.dcel.checkAndGetCircleEvents();
    this.events.addCircleEvents(circleEvents);
    nodeFormedDueToSiteRemoval.potentialCircleEvents = circleEvents;
  }

}
