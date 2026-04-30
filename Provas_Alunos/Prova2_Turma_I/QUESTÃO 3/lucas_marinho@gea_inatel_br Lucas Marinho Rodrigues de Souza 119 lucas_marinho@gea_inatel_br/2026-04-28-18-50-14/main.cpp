#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
    int N;
    int contador = 0;
    int numero;
    int uma, duas, tres, quatro, cinco;
    
    for(int i = 0; i < 6; i++){
        cin >> N;
      
      if(numero == 1){
          uma++;
      }
      else if(numero == 2){
          duas;
      }
      else if(numero == 3){
          tres++;
      }
      else if(numero == 4){
          quatro++;
      }
      else{
          cinco++;
      }
      
      cout << "1 estrela : " << uma << endl;
      cout << "2 estrela : " << duas << endl;
      cout << "3 estrela : " << tres << endl;
      cout << "4 estrela : " << quatro << endl;
      cout << "5 estrela : " << cinco << endl;
      
      return 0;
      
    }
}
      