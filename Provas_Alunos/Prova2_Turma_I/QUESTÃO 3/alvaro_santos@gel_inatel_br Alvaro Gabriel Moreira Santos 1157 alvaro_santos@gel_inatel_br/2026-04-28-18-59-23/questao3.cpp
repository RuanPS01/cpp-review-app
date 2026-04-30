#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int numeros;
    int estrela1, estrela2,  estrela3, estrela4, estrela5 ;
  while(numeros != 6){
      cin >> numeros;
      
      if (numeros == 1){
          estrela1 ++;
          estrela1 * 100;
          
      } if(numeros == 2){
          estrela2 ++;
          estrela2 *100;
         
      }if(numeros == 3 ){
          estrela3 ++;
          estrela3 *100;
         
      } if(numeros == 4){
          estrela4 ++;  
          estrela4 *100;
          
       }
  }
       cout << fixed << setprecision(2);
       cout << "1 estrela: " << estrela1 << endl;
       cout << "2 estrela: " << estrela2 << endl;
       cout << "3 estrela: " << estrela3 << endl; 
       cout << "4 estrela: " << estrela4 << endl; 
       cout << "5 estrela: " << estrela5 << endl; 
  
  
  return 0;
}