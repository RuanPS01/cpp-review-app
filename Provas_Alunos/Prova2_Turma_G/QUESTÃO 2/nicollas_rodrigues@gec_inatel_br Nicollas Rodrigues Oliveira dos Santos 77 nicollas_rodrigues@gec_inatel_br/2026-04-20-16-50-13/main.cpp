#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    
   int N;
   cin >> N;
   int numeros, i;
   float media;
   cin >> numeros;
   
   for(i = 0; i < N; i++) {
       i++;
   }
  
    media = (numeros * 2) / i;
    cout << fixed << setprecision(4);
    cout << media << endl;
    
    return 0;
}