#include <iostream>

using namespace std;

int main() {
  
  int i = 0, x, count = 0;
  int v[1000];
  
  do {
      
     cin >> v[i];
     count++;
     
  } while (v[i] != 0);
    
  cin >> x;
 
    
 for (i = 0; i < count; i++) {
     
     if (v[i] == x) {
         
         cout << x << " encontrado na posicao " << i << endl;
     }
     
     else {
         
         cout << "Elemento nao encontrado" << endl;
     }
 }   
    
    
    
    
    return 0;
}