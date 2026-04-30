#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    
   int N;
   double divisao = 0;
   int contador = 0;
   
   while(cin >> N && N != 0){
       divisao = N / 3 == 0;
       contador++;
   }
    cout << divisao << endl;
     
   return 0;
 }
   